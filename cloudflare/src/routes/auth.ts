/**
 * Accounts: registration, sign-in, sessions, password lifecycle, data export and
 * account deletion.
 *
 * Security choices worth calling out:
 *  * Sign-in failures are uniform — same message, same work — so the endpoint
 *    cannot be used to discover which addresses have accounts.
 *  * Five failed attempts lock an account for 15 minutes and send a notice.
 *  * Password reset tokens are single use, hashed at rest and expire in an hour.
 *  * Changing or resetting a password revokes every other session.
 */

import {
  apiKeyScopes,
  clearSessionCookie,
  createSession,
  authenticatePassword,
  currentUser,
  findUserByEmail,
  listSessions,
  maybePromoteAdmin,
  normaliseEmail,
  requireUser,
  revokeOtherSessions,
  revokeSession,
  setPassword,
  toPublicUser,
} from "../lib/auth";
import { checkPasswordStrength, hashPassword, newId, randomToken, sha256Hex } from "../lib/crypto";
import { all, first, isoAfter, isoDaysAfter, newId, nowIso, parseJson, run, stringifyJson } from "../lib/db";
import { queueEmail, templates } from "../lib/email";
import { ApiError, badRequest, forbidden, json, notFound, unauthorized, type Ctx } from "../lib/http";
import { notify, record } from "../lib/events";
import { enforceRateLimit } from "../lib/ratelimit";
import { booleanSetting, getSettings, numericSetting } from "../lib/settings";
import { body as readBody, optionalString, requireEmail, requirePassword, requireString } from "../lib/validate";
import type { AuthUser, Env, UserRow } from "../types";

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

function verificationEmailUrl(env: Env, token: string): string {
  const base = env.APP_URL?.replace(/\/$/, "") ?? "https://cloudgather.app";
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

function resetEmailUrl(env: Env, token: string): string {
  const base = env.APP_URL?.replace(/\/$/, "") ?? "https://cloudgather.app";
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sessionResponse(env: Env, req: Request, user: UserRow, ttlDays: number, maxSessions: number): Promise<Response> {
  const { cookie, session } = await createSession(env, req, user, ttlDays, maxSessions);
  return json(
    { user: toPublicUser(user), session: { id: session.id, expiresAt: session.expires_at } },
    { headers: { "set-cookie": cookie } },
  );
}

// ---------------------------------------------------------------------------
// Registration & sign-in
// ---------------------------------------------------------------------------

export async function register(ctx: Ctx): Promise<Response> {
  const settings = await getSettings(ctx.env);
  if (!booleanSetting(settings, "registration_enabled", true)) {
    throw forbidden("New sign-ups are paused right now. Please try again later.");
  }

  const input = readBody(await ctx.req.json().catch(() => ({})));
  const email = requireEmail(input);
  const password = requirePassword(input);
  const displayName = optionalString(input, "displayName", { max: 80 }) ?? email.split("@")[0];

  const strength = checkPasswordStrength(password);
  if (!strength.valid) {
    throw new ApiError("unprocessable", strength.problems[0], { errors: strength.problems });
  }

  await enforceRateLimit(
    ctx.env,
    { scope: "register", limit: 10, windowSeconds: 900, identifier: clientIp(ctx.req) },
    "Too many sign-up attempts from this network. Please try again in a few minutes.",
  );

  if (await findUserByEmail(ctx.env, email)) {
    throw new ApiError("conflict", "An account with that email already exists. Try signing in instead.");
  }

  const hashed = await hashPassword(password, Number(ctx.env.PASSWORD_ITERATIONS) || 210_000);
  const quotaGb = numericSetting(settings, "default_quota_gb", 50);
  const userId = newId("usr");
  const timestamp = nowIso();

  await run(
    ctx.env.DB,
    `INSERT INTO users (id, email, email_normalized, display_name, password_hash, password_salt, password_iterations, password_algo,
                        storage_quota_bytes, settings, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pbkdf2-sha256', ?, ?, ?, ?, ?)`,
    userId,
    email,
    email,
    displayName,
    hashed.hash,
    hashed.salt,
    hashed.iterations,
    Math.round(quotaGb * 1024 ** 3),
    stringifyJson({}),
    booleanSetting(settings, "email_verification_required") ? 0 : 1,
    timestamp,
    timestamp,
  );

  let user = await first<UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, userId);
  if (!user) throw new ApiError("internal_error", "The account could not be created.");

  user = await maybePromoteAdmin(ctx.env, user);
  await record(ctx.env, { action: "auth.registered", user, ctx, details: { method: "password" } });
  await notify(ctx.env, user.id, {
    type: "welcome",
    title: "Welcome to CloudGather",
    body: "Connect a drive or upload your first file to get started.",
    link: "/dashboard",
  });

  const welcome = templates.welcome(ctx.env.APP_NAME ?? "CloudGather", ctx.env.APP_URL ?? "", displayName);
  await queueEmail(ctx.env, { to: email, subject: welcome.subject, html: welcome.html });

  if (booleanSetting(settings, "email_verification_required")) {
    await issueVerificationToken(ctx.env, user);
  }

  return sessionResponse(
    ctx.env,
    ctx.req,
    user,
    numericSetting(settings, "session_ttl_days", 30),
    numericSetting(settings, "max_sessions_per_user", 10),
  );
}

export async function login(ctx: Ctx): Promise<Response> {
  const settings = await getSettings(ctx.env);
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const email = requireEmail(input);
  const password = requirePassword(input);

  await enforceRateLimit(
    ctx.env,
    { scope: "login", limit: numericSetting(settings, "auth_rate_limit_per_15min", 30), windowSeconds: 900, identifier: clientIp(ctx.req) },
    "Too many sign-in attempts from this network. Please wait a few minutes and try again.",
  );

  const user = await findUserByEmail(ctx.env, email);

  if (user?.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60_000);
    throw new ApiError("rate_limited", `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`, {
      lockedUntil: user.locked_until,
    });
  }

  if (user?.status === "suspended") {
    throw forbidden("This account is suspended. Contact support if you think that is a mistake.");
  }

  const authenticated = await authenticatePassword(ctx.env, user, password);

  if (!authenticated) {
    if (user) {
      const attempts = user.failed_login_attempts + 1;
      const lockUntil = attempts >= LOCK_THRESHOLD ? isoAfter(LOCK_MINUTES * 60) : null;
      await run(
        ctx.env.DB,
        `UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?`,
        lockUntil ? 0 : attempts,
        lockUntil,
        user.id,
      );
      if (lockUntil) {
        await record(ctx.env, { action: "auth.lockout", user, ctx, details: { attempts } });
        await queueEmail(ctx.env, {
          to: user.email,
          subject: "Repeated failed sign-in attempts",
          html: `<p>We locked sign-in for your account for ${LOCK_MINUTES} minutes after ${attempts} failed attempts.</p><p>If this was not you, reset your password.</p>`,
        });
      }
    }
    // Same response whether or not the account exists.
    throw unauthorized("That email and password combination is incorrect.");
  }

  await run(
    ctx.env.DB,
    `UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ? WHERE id = ?`,
    nowIso(),
    nowIso(),
    authenticated.id,
  );

  const promoted = await maybePromoteAdmin(ctx.env, authenticated);
  await record(ctx.env, { action: "auth.login", user: promoted, ctx });

  return sessionResponse(
    ctx.env,
    ctx.req,
    promoted,
    numericSetting(settings, "session_ttl_days", 30),
    numericSetting(settings, "max_sessions_per_user", 10),
  );
}

export async function logout(ctx: Ctx): Promise<Response> {
  const auth = ctx.state.auth as AuthUser | undefined;
  if (auth?.session) {
    await revokeSession(ctx.env, auth.session.id, auth.user.id);
    await record(ctx.env, { action: "auth.logout", user: auth.user, ctx });
  }
  return json(
    { ok: true },
    { headers: { "set-cookie": clearSessionCookie(ctx.env, ctx.url) } },
  );
}

export async function session(ctx: Ctx): Promise<Response> {
  const auth = ctx.state.auth as AuthUser | undefined;
  if (!auth) return json({ user: null, authenticated: false });
  return json({ user: toPublicUser(auth.user), authenticated: true });
}

export async function me(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  return json({ user: toPublicUser(user) });
}

export async function sessions(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const current = (ctx.state.auth as AuthUser | undefined)?.session;
  const rows = await listSessions(ctx.env, user.id);
  return json({
    sessions: rows.map((row) => ({
      id: row.id,
      current: row.id === current?.id,
      ip: row.ip,
      userAgent: row.user_agent,
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      expiresAt: row.expires_at,
    })),
  });
}

export async function revokeSessionRoute(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const revoked = await revokeSession(ctx.env, ctx.params.id, user.id);
  if (!revoked) throw notFound("That session is already signed out.");
  const current = (ctx.state.auth as AuthUser | undefined)?.session;
  const isCurrent = current?.id === ctx.params.id;
  return json(
    { ok: true, signedOutCurrent: isCurrent },
    isCurrent ? { headers: { "set-cookie": clearSessionCookie(ctx.env, ctx.url) } } : {},
  );
}

export async function updateProfile(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const displayName = optionalString(input, "displayName", { max: 80 });
  const avatarUrl = optionalString(input, "avatarUrl", { max: 500 });
  const settingsInput = input.settings;

  const currentSettings = parseJson<Record<string, string>>(user.settings, {});
  let settings = currentSettings;
  if (settingsInput !== undefined) {
    if (typeof settingsInput !== "object" || settingsInput === null || Array.isArray(settingsInput)) {
      throw badRequest("settings must be an object.");
    }
    const allowed = ["theme", "density", "defaultView", "timezone", "emailDigest", "notifyOnShare", "reduceMotion"];
    settings = { ...currentSettings };
    for (const [key, value] of Object.entries(settingsInput as Record<string, unknown>)) {
      if (!allowed.includes(key)) continue;
      settings[key] = String(value).slice(0, 60);
    }
  }

  await run(
    ctx.env.DB,
    `UPDATE users SET display_name = ?, avatar_url = ?, settings = ?, updated_at = ? WHERE id = ?`,
    displayName ?? user.display_name,
    avatarUrl ?? user.avatar_url,
    stringifyJson(settings),
    nowIso(),
    user.id,
  );

  const updated = await first<UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, user.id);
  return json({ user: toPublicUser(updated ?? user) });
}

// ---------------------------------------------------------------------------
// Password lifecycle
// ---------------------------------------------------------------------------

export async function forgotPassword(ctx: Ctx): Promise<Response> {
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const email = requireEmail(input);

  await enforceRateLimit(
    ctx.env,
    { scope: "forgot", limit: 8, windowSeconds: 900, identifier: clientIp(ctx.req) },
    "Too many reset requests from this network. Please try again shortly.",
  );

  const user = await findUserByEmail(ctx.env, email);
  const genericMessage = "If an account exists for that address, a reset link is on its way.";

  if (!user) return json({ ok: true, message: genericMessage });

  await run(ctx.env.DB, `UPDATE tokens SET used_at = ? WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL`, nowIso(), user.id);

  const token = randomToken(32);
  await run(
    ctx.env.DB,
    `INSERT INTO tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, 'password_reset', ?, ?)`,
    newId("tok"),
    user.id,
    await sha256Hex(token),
    isoAfter(3600),
  );

  const link = resetEmailUrl(ctx.env, token);
  const template = templates.passwordReset(ctx.env.APP_NAME ?? "CloudGather", link);
  const delivery = await queueEmail(ctx.env, { to: user.email, subject: template.subject, html: template.html });

  await record(ctx.env, { action: "auth.password_reset_requested", user, ctx });

  const response: Record<string, unknown> = { ok: true, message: genericMessage, emailConfigured: Boolean(ctx.env.RESEND_API_KEY) };
  // Outside production, hand the link back when no mail provider is configured so
  // the flow can still be completed and tested end to end.
  if (!ctx.env.RESEND_API_KEY && ctx.env.ENVIRONMENT !== "production") {
    response.developmentResetUrl = link;
  }
  void delivery;
  return json(response);
}

export async function resetPassword(ctx: Ctx): Promise<Response> {
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const token = requireString(input, "token", { label: "Reset token", max: 200 });
  const password = requirePassword(input);

  const row = await first<{ id: string; user_id: string; used_at: string | null; expires_at: string }>(
    ctx.env.DB,
    `SELECT * FROM tokens WHERE token_hash = ? AND purpose = 'password_reset'`,
    await sha256Hex(token),
  );

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest("That reset link is invalid or has expired. Request a new one.");
  }

  await setPassword(ctx.env, row.user_id, password);
  await run(ctx.env.DB, `UPDATE tokens SET used_at = ? WHERE id = ?`, nowIso(), row.id);
  await revokeOtherSessions(ctx.env, row.user_id);

  const user = await first<UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, row.user_id);
  if (user) {
    await record(ctx.env, { action: "auth.password_reset", user, ctx });
    const template = templates.passwordChanged(ctx.env.APP_NAME ?? "CloudGather", ctx.env.APP_URL ?? "");
    await queueEmail(ctx.env, { to: user.email, subject: template.subject, html: template.html });
  }

  return json({ ok: true, message: "Your password has been updated. Sign in with your new password." });
}

export async function changePassword(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const currentPassword = requireString(input, "currentPassword", { label: "Current password", max: 200 });
  const newPassword = requirePassword(input, "newPassword");

  const authenticated = await authenticatePassword(ctx.env, user, currentPassword);
  if (!authenticated) throw unauthorized("Your current password is not correct.");

  if (currentPassword === newPassword) throw badRequest("Choose a password you have not used here before.");

  await setPassword(ctx.env, user.id, newPassword);
  const revoked = await revokeOtherSessions(ctx.env, user.id, (ctx.state.auth as AuthUser | undefined)?.session?.id);
  await record(ctx.env, { action: "auth.password_changed", user, ctx, details: { sessionsRevoked: revoked } });

  const template = templates.passwordChanged(ctx.env.APP_NAME ?? "CloudGather", ctx.env.APP_URL ?? "");
  await queueEmail(ctx.env, { to: user.email, subject: template.subject, html: template.html });

  return json({ ok: true, sessionsRevoked: revoked });
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

async function issueVerificationToken(env: Env, user: UserRow): Promise<void> {
  const token = randomToken(32);
  await run(
    env.DB,
    `INSERT INTO tokens (id, user_id, purpose, token_hash, expires_at) VALUES (?, ?, 'email_verify', ?, ?)`,
    newId("tok"),
    user.id,
    await sha256Hex(token),
    isoDaysAfter(3),
  );
  const template = templates.verifyEmail(env.APP_NAME ?? "CloudGather", verificationEmailUrl(env, token));
  await queueEmail(env, { to: user.email, subject: template.subject, html: template.html });
}

export async function resendVerification(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  if (user.email_verified) return json({ ok: true, alreadyVerified: true });
  await enforceRateLimit(
    ctx.env,
    { scope: "verify", limit: 5, windowSeconds: 900, identifier: user.id },
    "Verification emails are limited to five every fifteen minutes.",
  );
  await issueVerificationToken(ctx.env, user);
  return json({ ok: true, emailConfigured: Boolean(ctx.env.RESEND_API_KEY) });
}

export async function verifyEmail(ctx: Ctx): Promise<Response> {
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const token = requireString(input, "token", { label: "Verification token", max: 200 });

  const row = await first<{ id: string; user_id: string; used_at: string | null; expires_at: string }>(
    ctx.env.DB,
    `SELECT * FROM tokens WHERE token_hash = ? AND purpose = 'email_verify'`,
    await sha256Hex(token),
  );
  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    throw badRequest("That verification link is invalid or has expired.");
  }

  await run(ctx.env.DB, `UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?`, nowIso(), row.user_id);
  await run(ctx.env.DB, `UPDATE tokens SET used_at = ? WHERE id = ?`, nowIso(), row.id);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Export & deletion
// ---------------------------------------------------------------------------

export async function exportAccount(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);

  const [files, shares, providers, keys, activity] = await Promise.all([
    all<Record<string, unknown>>(ctx.env.DB, `SELECT id, name, path, size, mime_type, is_folder, starred, trashed_at, created_at, updated_at FROM files WHERE user_id = ? LIMIT 10000`, user.id),
    all<Record<string, unknown>>(
      ctx.env.DB,
      `SELECT id, file_id, CASE WHEN recipient_email IS NOT NULL THEN 'email' ELSE 'link' END AS kind,
              permission, recipient_email, expires_at, download_count, view_count, revoked_at, created_at
         FROM shares WHERE owner_id = ? LIMIT 5000`,
      user.id,
    ),
    all<Record<string, unknown>>(ctx.env.DB, `SELECT id, provider_name, display_name, status, account_email, total_space, used_space, created_at FROM providers WHERE user_id = ?`, user.id),
    all<Record<string, unknown>>(ctx.env.DB, `SELECT id, name, key_prefix, permissions, last_used_at, expires_at, revoked_at, created_at FROM api_keys WHERE user_id = ?`, user.id),
    all<Record<string, unknown>>(ctx.env.DB, `SELECT action, resource_type, details, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 2000`, user.id),
  ]);

  const payload = {
    exportedAt: nowIso(),
    account: { ...toPublicUser(user), settings: parseJson<Record<string, string>>(user.settings, {}) },
    files,
    shares,
    providers,
    apiKeys: keys.map((key) => ({ ...key, permissions: parseJson<string[]>(key.permissions as string, []) })),
    activity,
    usage: await all<Record<string, unknown>>(ctx.env.DB, `SELECT * FROM usage_daily WHERE user_id = ? ORDER BY day DESC LIMIT 730`, user.id),
    notes: [
      "File contents are not included in this export; download them from the app or through the API.",
      "Provider access tokens are intentionally excluded.",
    ],
  };

  await record(ctx.env, { action: "auth.data_exported", user, ctx });

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="cloudgather-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}

export async function deleteAccount(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = readBody(await ctx.req.json().catch(() => ({})));
  const password = requireString(input, "password", { label: "Password" });
  const confirmation = requireString(input, "confirmation", { label: "Confirmation" });

  if (confirmation.trim().toUpperCase() !== "DELETE") {
    throw badRequest('Type DELETE in the confirmation field to remove your account.');
  }

  const authenticated = await authenticatePassword(ctx.env, user, password);
  if (!authenticated) throw unauthorized("That password is not correct.");

  if (user.role === "admin") {
    const admins = await first<{ count: number }>(ctx.env.DB, `SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`);
    if ((admins?.count ?? 0) <= 1) {
      throw badRequest("This is the only administrator account. Promote another administrator before deleting it.");
    }
  }

  // Remove stored objects first so nothing is left orphaned in the bucket.
  let removedObjects = 0;
  let cursor: string | undefined;
  do {
    const listing = await ctx.env.FILES.list({ prefix: `${user.id}/`, cursor, limit: 500 });
    const keys = listing.objects.map((object) => object.key);
    if (keys.length > 0) {
      await ctx.env.FILES.delete(keys);
      removedObjects += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);

  await record(ctx.env, { action: "auth.account_deleted", user, ctx, details: { removedObjects } });
  await run(ctx.env.DB, `DELETE FROM users WHERE id = ?`, user.id);

  return json(
    { ok: true, removedObjects },
    { headers: { "set-cookie": clearSessionCookie(ctx.env, ctx.url) } },
  );
}

/** Re-exported for the router so route modules do not import deep paths. */
export { currentUser, requireUser };
