/** Authentication: registration, login, MFA, sessions, password and email flows. */
import { Router } from "../core/router";
import type { Ctx } from "../core/context";
import { loadUserByEmail, loadUserById, publicUser, requireUser, type AuthUser } from "../core/context";
import { all, first, run } from "../core/db";
import {
  badRequest,
  conflict,
  forbidden,
  json,
  noContent,
  notFound,
  readJson,
  requestLocation,
  unauthorized,
  unprocessable,
} from "../core/http";
import {
  decryptString,
  encryptString,
  generateTotpSecret,
  passwordHash,
  randomCode,
  randomToken,
  sha256Hex,
  totpUri,
  verifyPassword,
  verifyTotp,
} from "../core/crypto";
import { audit } from "../core/audit";
import { sendEmail, templates } from "../core/email";
import { notify } from "../core/notify";
import { getSettings, passwordPolicy } from "../core/settings";
import { validatePassword } from "../core/validate";
import { id, inDays, inMinutes, isEmail, normalizeEmail, now, parseJson } from "../core/util";
import { appUrl } from "../env";
import { dispatch } from "../core/webhooks";

export const SESSION_COOKIE = "cloudgather_session";

/* ------------------------------------------------------------------ *
 * Session helpers (shared with the social OAuth module)
 * ------------------------------------------------------------------ */

export async function createSession(ctx: Ctx, user: AuthUser, client = "web") {
  const token = randomToken();
  const days = Math.min(Number(ctx.env.SESSION_TTL_DAYS || ctx.settings.session_idle_timeout_days || 30), 90);
  const expiresAt = inDays(days);
  const sessionId = id();
  await run(
    ctx.env,
    `INSERT INTO sessions(id, user_id, token_hash, expires_at, ip_address, user_agent, location, client, last_seen_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    sessionId,
    user.id,
    await sha256Hex(token),
    expiresAt,
    ctx.ip,
    ctx.userAgent,
    requestLocation(ctx.request),
    client,
  );
  await run(ctx.env, "UPDATE users SET last_login_at = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?", now(), user.id);
  return { token, expires_at: expiresAt, session_id: sessionId, user: publicUser(user) };
}

/** Emails the owner when a sign-in comes from an unfamiliar device. */
async function checkNewDevice(ctx: Ctx, user: AuthUser): Promise<void> {
  const seen = await first<{ value: number }>(
    ctx.env,
    "SELECT count(*) AS value FROM sessions WHERE user_id = ? AND user_agent = ? AND id != ''",
    user.id,
    ctx.userAgent,
  );
  if (Number(seen?.value ?? 0) > 1) return;
  const template = templates.newDeviceLogin(
    ctx.env,
    ctx.userAgent,
    requestLocation(ctx.request) || "Unknown location",
    ctx.ip,
    new Date().toUTCString(),
  );
  await notify(ctx.env, {
    userId: user.id,
    type: "security.login",
    title: "New sign-in detected",
    body: `${ctx.userAgent} · ${requestLocation(ctx.request) || ctx.ip}`,
    link: "/settings?tab=security",
    email: template,
  });
}

export async function issueEmailVerification(ctx: Ctx, user: AuthUser): Promise<void> {
  const token = randomToken();
  await run(
    ctx.env,
    "INSERT INTO email_verification_tokens(id, user_id, email, token_hash, expires_at) VALUES(?, ?, ?, ?, ?)",
    id(),
    user.id,
    user.email,
    await sha256Hex(token),
    inDays(1),
  );
  const link = `${appUrl(ctx.env)}/verify-email?token=${encodeURIComponent(token)}`;
  const template = templates.verifyEmail(ctx.env, link, user.display_name || user.email.split("@")[0]);
  await sendEmail(ctx.env, { to: user.email, subject: template.subject, html: template.html, tag: "verify-email", userId: user.id });
}

/* ------------------------------------------------------------------ *
 * Routes
 * ------------------------------------------------------------------ */

export const authRoutes = new Router();

authRoutes.post(
  "/api/auth/register",
  async (ctx) => {
    const settings = ctx.settings;
    if (!settings.registration_enabled) throw forbidden("New registrations are currently disabled.", "registration_disabled");

    const payload = await readJson<{ email: string; password: string; displayName?: string; marketingOptIn?: boolean; timezone?: string }>(ctx.request);
    const email = normalizeEmail(payload.email);
    if (!isEmail(email)) throw badRequest("Enter a valid email address.", "invalid_email");

    const allowlist = String(settings.signup_domain_allowlist || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
    if (allowlist.length && !allowlist.some((domain) => email.endsWith(`@${domain}`))) {
      throw forbidden("Registration is limited to approved email domains.", "domain_not_allowed");
    }

    const password = validatePassword(payload.password, await passwordPolicy(ctx.env));
    const existing = await first<{ id: string }>(ctx.env, "SELECT id FROM users WHERE email = ? COLLATE NOCASE", email);
    if (existing) throw conflict("An account with this email already exists. Try signing in instead.", "email_taken");

    const salt = randomToken();
    const userId = id();
    const isFirstAdmin = normalizeEmail(ctx.env.ADMIN_EMAIL) === email;
    const displayName = (payload.displayName || email.split("@")[0]).trim().slice(0, 100);

    await run(
      ctx.env,
      `INSERT INTO users(id, email, password_hash, password_salt, display_name, role, plan, status, marketing_opt_in, timezone, password_changed_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
      userId,
      email,
      await passwordHash(password, salt),
      salt,
      displayName,
      isFirstAdmin ? "admin" : "user",
      settings.default_plan || "free",
      payload.marketingOptIn ? 1 : 0,
      payload.timezone?.slice(0, 64) || null,
      now(),
    );

    const user = (await loadUserById(ctx.env, userId))!;
    ctx.user = user;
    await audit(ctx, { action: "user.registered", resourceType: "user", resourceId: userId });

    ctx.waitUntil(issueEmailVerification(ctx, user));
    const welcome = templates.welcome(ctx.env, displayName);
    ctx.waitUntil(sendEmail(ctx.env, { to: email, subject: welcome.subject, html: welcome.html, tag: "welcome", userId }).then(() => undefined));
    if (payload.marketingOptIn) {
      ctx.waitUntil(
        run(ctx.env, "INSERT OR IGNORE INTO newsletter_subscribers(id, email, source) VALUES(?, ?, 'signup')", id(), email).then(() => undefined),
      );
    }

    return json(await createSession(ctx, user), 201);
  },
  { rateLimit: { limit: 10, windowSeconds: 3600 }, maintenanceSafe: false, summary: "Create an account" },
);

authRoutes.post(
  "/api/auth/login",
  async (ctx) => {
    const payload = await readJson<{ email: string; password: string; remember?: boolean }>(ctx.request);
    const email = normalizeEmail(payload.email);
    const row = await first<{ id: string; password_hash: string; password_salt: string; locked_until: string | null; failed_login_count: number; status: string; totp_enabled_at: string | null }>(
      ctx.env,
      "SELECT id, password_hash, password_salt, locked_until, failed_login_count, status, totp_enabled_at FROM users WHERE email = ? COLLATE NOCASE",
      email,
    );

    const genericFailure = unauthorized("Email or password is incorrect.", "invalid_credentials");
    if (!row) {
      await passwordHash(String(payload.password || ""), "decoy-salt"); // constant-ish time
      throw genericFailure;
    }
    if (row.status === "suspended") throw forbidden("This account has been suspended. Contact support for help.", "account_suspended");
    if (row.locked_until && row.locked_until > now()) {
      throw forbidden("Too many failed attempts. Try again later or reset your password.", "account_locked");
    }

    const valid = await verifyPassword(String(payload.password || ""), row.password_salt, row.password_hash);
    if (!valid) {
      const attempts = Number(row.failed_login_count || 0) + 1;
      const maxAttempts = Number(ctx.settings.max_login_attempts) || 8;
      const lockUntil = attempts >= maxAttempts ? inMinutes(Number(ctx.settings.lockout_minutes) || 15) : null;
      await run(ctx.env, "UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?", attempts, lockUntil, row.id);
      await audit(ctx, { action: "user.login_failed", resourceType: "user", resourceId: row.id, severity: "warning", details: { attempts } });
      if (lockUntil) throw forbidden("Too many failed attempts. Your account is locked for a short period.", "account_locked");
      throw genericFailure;
    }

    const user = (await loadUserById(ctx.env, row.id))!;
    ctx.user = user;

    if (row.totp_enabled_at) {
      const challenge = randomToken();
      await run(
        ctx.env,
        "INSERT INTO mfa_challenges(id, user_id, token_hash, expires_at) VALUES(?, ?, ?, ?)",
        id(),
        user.id,
        await sha256Hex(challenge),
        inMinutes(10),
      );
      await audit(ctx, { action: "user.mfa_challenged", resourceType: "user", resourceId: user.id });
      return json({ mfa_required: true, challenge, methods: ["totp", "recovery_code"] });
    }

    await audit(ctx, { action: "user.login", resourceType: "user", resourceId: user.id });
    const session = await createSession(ctx, user);
    ctx.waitUntil(checkNewDevice(ctx, user));
    return json(session);
  },
  { rateLimit: { limit: 20, windowSeconds: 900 }, summary: "Sign in with email and password" },
);

authRoutes.post(
  "/api/auth/mfa/verify",
  async (ctx) => {
    const payload = await readJson<{ challenge: string; code: string }>(ctx.request);
    const challengeHash = await sha256Hex(String(payload.challenge || ""));
    const challenge = await first<{ id: string; user_id: string }>(
      ctx.env,
      "SELECT id, user_id FROM mfa_challenges WHERE token_hash = ? AND consumed_at IS NULL AND datetime(expires_at) > datetime('now')",
      challengeHash,
    );
    if (!challenge) throw unauthorized("This verification request expired. Sign in again.", "mfa_challenge_expired");

    const secretRow = await first<{ totp_secret: string | null }>(ctx.env, "SELECT totp_secret FROM users WHERE id = ?", challenge.user_id);
    if (!secretRow?.totp_secret) throw badRequest("Two-factor authentication is not enabled for this account.", "mfa_not_enabled");

    const secret = await decryptString(ctx.env, secretRow.totp_secret).catch(() => secretRow.totp_secret!);
    const code = String(payload.code || "").trim();
    let verified = await verifyTotp(secret, code);

    if (!verified) {
      const codeHash = await sha256Hex(code.toUpperCase().replace(/\s/g, ""));
      const recovery = await first<{ id: string }>(
        ctx.env,
        "SELECT id FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL",
        challenge.user_id,
        codeHash,
      );
      if (recovery) {
        verified = true;
        await run(ctx.env, "UPDATE recovery_codes SET used_at = ? WHERE id = ?", now(), recovery.id);
      }
    }
    if (!verified) throw unauthorized("That code is not valid. Try again.", "invalid_mfa_code");

    await run(ctx.env, "UPDATE mfa_challenges SET consumed_at = ? WHERE id = ?", now(), challenge.id);
    const user = (await loadUserById(ctx.env, challenge.user_id))!;
    ctx.user = user;
    await audit(ctx, { action: "user.login", resourceType: "user", resourceId: user.id, details: { mfa: true } });
    const session = await createSession(ctx, user);
    ctx.waitUntil(checkNewDevice(ctx, user));
    return json(session);
  },
  { rateLimit: { limit: 15, windowSeconds: 900 }, summary: "Complete a two-factor sign-in" },
);

authRoutes.get("/api/auth/me", async (ctx) => {
  const user = requireUser(ctx);
  const unread = await first<{ value: number }>(
    ctx.env,
    "SELECT count(*) AS value FROM notifications WHERE user_id = ? AND read_at IS NULL",
    user.id,
  );
  return json({ user: publicUser(user), unread_notifications: Number(unread?.value ?? 0) });
}, { auth: true, scope: "read", summary: "Current user" });

authRoutes.post("/api/auth/logout", async (ctx) => {
  if (ctx.sessionId) await run(ctx.env, "UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?", ctx.sessionId);
  await audit(ctx, { action: "user.logout" });
  return noContent();
}, { auth: true });

authRoutes.post("/api/auth/logout-all", async (ctx) => {
  const user = requireUser(ctx);
  await run(ctx.env, "UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL", user.id);
  await audit(ctx, { action: "user.logout_all", severity: "warning" });
  return noContent();
}, { auth: true });

authRoutes.get("/api/auth/sessions", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all<Record<string, unknown>>(
    ctx.env,
    `SELECT id, ip_address, user_agent, location, client, created_at, last_seen_at, expires_at
       FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')
      ORDER BY last_seen_at DESC NULLS LAST, created_at DESC LIMIT 50`,
    user.id,
  );
  return json({ sessions: rows.map((row) => ({ ...row, current: row.id === ctx.sessionId })) });
}, { auth: true, summary: "List active sessions" });

authRoutes.delete("/api/auth/sessions/:id", async (ctx) => {
  const user = requireUser(ctx);
  const result = await run(ctx.env, "UPDATE sessions SET revoked_at = datetime('now') WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!result.meta.changes) throw notFound("Session not found.");
  await audit(ctx, { action: "session.revoked", resourceType: "session", resourceId: ctx.params.id });
  return noContent();
}, { auth: true });

/* ---------------------------------------------------------- passwords */

authRoutes.patch("/api/auth/password", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ currentPassword?: string; password: string }>(ctx.request);
  const row = await first<{ password_hash: string; password_salt: string }>(
    ctx.env,
    "SELECT password_hash, password_salt FROM users WHERE id = ?",
    user.id,
  );
  const hasPassword = Boolean(row?.password_hash);
  if (hasPassword) {
    if (!payload.currentPassword) throw badRequest("Enter your current password.", "current_password_required");
    const valid = await verifyPassword(String(payload.currentPassword), row!.password_salt, row!.password_hash);
    if (!valid) throw unauthorized("Your current password is incorrect.", "invalid_credentials");
  }

  const password = validatePassword(payload.password, await passwordPolicy(ctx.env));
  const salt = randomToken();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, password_changed_at = ?, updated_at = ? WHERE id = ?").bind(
      await passwordHash(password, salt),
      salt,
      now(),
      now(),
      user.id,
    ),
    ctx.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND id != ?").bind(user.id, ctx.sessionId || ""),
  ]);

  await audit(ctx, { action: "user.password_changed", severity: "warning" });
  const template = templates.passwordChanged(ctx.env, new Date().toUTCString());
  ctx.waitUntil(
    notify(ctx.env, {
      userId: user.id,
      type: "security.password",
      title: "Your password was changed",
      body: "All other sessions were signed out.",
      link: "/settings?tab=security",
      email: template,
      forceEmail: true,
    }),
  );
  return json({ ok: true });
}, { auth: true, summary: "Change password" });

authRoutes.post(
  "/api/auth/password/reset",
  async (ctx) => {
    const payload = await readJson<{ email: string }>(ctx.request);
    const email = normalizeEmail(payload.email);
    const user = await loadUserByEmail(ctx.env, email);
    if (user) {
      const token = randomToken();
      await run(
        ctx.env,
        "INSERT INTO password_reset_tokens(id, user_id, token_hash, expires_at) VALUES(?, ?, ?, ?)",
        id(),
        user.id,
        await sha256Hex(token),
        inMinutes(60),
      );
      const link = `${appUrl(ctx.env)}/reset-password?token=${encodeURIComponent(token)}`;
      const template = templates.passwordReset(ctx.env, link);
      await sendEmail(ctx.env, { to: user.email, subject: template.subject, html: template.html, tag: "password-reset", userId: user.id });
      await audit(ctx, { action: "user.password_reset_requested", actorId: user.id, resourceType: "user", resourceId: user.id });
    }
    return json({ ok: true, message: "If an account exists for that address, reset instructions are on the way." });
  },
  { rateLimit: { limit: 5, windowSeconds: 900 }, summary: "Request a password reset" },
);

authRoutes.post(
  "/api/auth/password/confirm",
  async (ctx) => {
    const payload = await readJson<{ token: string; password: string }>(ctx.request);
    const tokenHash = await sha256Hex(String(payload.token || ""));
    const row = await first<{ id: string; user_id: string }>(
      ctx.env,
      "SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')",
      tokenHash,
    );
    if (!row) throw badRequest("This reset link is invalid or has expired. Request a new one.", "invalid_reset_token");

    const password = validatePassword(payload.password, await passwordPolicy(ctx.env));
    const salt = randomToken();
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE users SET password_hash = ?, password_salt = ?, password_changed_at = ?, failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE id = ?").bind(
        await passwordHash(password, salt),
        salt,
        now(),
        now(),
        row.user_id,
      ),
      ctx.env.DB.prepare("UPDATE password_reset_tokens SET used_at = ? WHERE id = ?").bind(now(), row.id),
      ctx.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ?").bind(row.user_id),
    ]);
    await audit(ctx, { action: "user.password_reset", actorId: row.user_id, severity: "warning" });
    const template = templates.passwordChanged(ctx.env, new Date().toUTCString());
    ctx.waitUntil(
      notify(ctx.env, {
        userId: row.user_id,
        type: "security.password",
        title: "Your password was reset",
        link: "/login",
        email: template,
        forceEmail: true,
      }),
    );
    return json({ ok: true });
  },
  { rateLimit: { limit: 10, windowSeconds: 900 }, summary: "Complete a password reset" },
);

/* ------------------------------------------------------- verification */

authRoutes.post("/api/auth/email/verify/send", async (ctx) => {
  const user = requireUser(ctx);
  if (user.email_verified_at) return json({ ok: true, already_verified: true });
  await issueEmailVerification(ctx, user);
  return json({ ok: true });
}, { auth: true, rateLimit: { limit: 5, windowSeconds: 900, by: "user" } });

authRoutes.post("/api/auth/email/verify/confirm", async (ctx) => {
  const payload = await readJson<{ token: string }>(ctx.request);
  const tokenHash = await sha256Hex(String(payload.token || ""));
  const row = await first<{ id: string; user_id: string; email: string }>(
    ctx.env,
    "SELECT id, user_id, email FROM email_verification_tokens WHERE token_hash = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')",
    tokenHash,
  );
  if (!row) throw badRequest("This verification link is invalid or has expired.", "invalid_verification_token");
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?").bind(now(), now(), row.user_id),
    ctx.env.DB.prepare("UPDATE email_verification_tokens SET used_at = ? WHERE id = ?").bind(now(), row.id),
  ]);
  await audit(ctx, { action: "user.email_verified", actorId: row.user_id, resourceType: "user", resourceId: row.user_id });
  return json({ ok: true, email: row.email });
}, { rateLimit: { limit: 20, windowSeconds: 900 } });

/* -------------------------------------------------- two-factor (TOTP) */

authRoutes.post("/api/auth/2fa/setup", async (ctx) => {
  const user = requireUser(ctx);
  if (user.totp_enabled) throw conflict("Two-factor authentication is already enabled.", "mfa_already_enabled");
  const secret = generateTotpSecret();
  const stored = ctx.env.ENCRYPTION_KEY ? await encryptString(ctx.env, secret) : secret;
  await run(ctx.env, "UPDATE users SET totp_secret = ?, totp_enabled_at = NULL WHERE id = ?", stored, user.id);
  return json({ secret, otpauth_url: totpUri(secret, user.email, ctx.settings.app_name || "CloudGather") });
}, { auth: true, summary: "Begin two-factor enrolment" });

authRoutes.post("/api/auth/2fa/enable", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ code: string }>(ctx.request);
  const row = await first<{ totp_secret: string | null; totp_enabled_at: string | null }>(
    ctx.env,
    "SELECT totp_secret, totp_enabled_at FROM users WHERE id = ?",
    user.id,
  );
  if (!row?.totp_secret) throw badRequest("Start two-factor setup first.", "mfa_setup_required");
  const secret = await decryptString(ctx.env, row.totp_secret).catch(() => row.totp_secret!);
  if (!(await verifyTotp(secret, String(payload.code || "")))) throw unprocessable("That code is not valid. Check your authenticator app.", "invalid_mfa_code");

  const codes = Array.from({ length: 10 }, () => randomCode(10));
  const statements = [
    ctx.env.DB.prepare("UPDATE users SET totp_enabled_at = ?, updated_at = ? WHERE id = ?").bind(now(), now(), user.id),
    ctx.env.DB.prepare("DELETE FROM recovery_codes WHERE user_id = ?").bind(user.id),
    ...(await Promise.all(
      codes.map(async (code) =>
        ctx.env.DB.prepare("INSERT INTO recovery_codes(id, user_id, code_hash) VALUES(?, ?, ?)").bind(id(), user.id, await sha256Hex(code)),
      ),
    )),
  ];
  await ctx.env.DB.batch(statements);
  await audit(ctx, { action: "user.mfa_enabled", severity: "warning" });
  ctx.waitUntil(
    notify(ctx.env, {
      userId: user.id,
      type: "security.mfa",
      title: "Two-factor authentication enabled",
      body: "Keep your recovery codes somewhere safe.",
      link: "/settings?tab=security",
    }),
  );
  return json({ ok: true, recovery_codes: codes });
}, { auth: true, summary: "Enable two-factor authentication" });

authRoutes.post("/api/auth/2fa/disable", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ password: string }>(ctx.request);
  const row = await first<{ password_hash: string; password_salt: string }>(
    ctx.env,
    "SELECT password_hash, password_salt FROM users WHERE id = ?",
    user.id,
  );
  if (row?.password_hash && !(await verifyPassword(String(payload.password || ""), row.password_salt, row.password_hash))) {
    throw unauthorized("Your password is incorrect.", "invalid_credentials");
  }
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("UPDATE users SET totp_secret = NULL, totp_enabled_at = NULL, updated_at = ? WHERE id = ?").bind(now(), user.id),
    ctx.env.DB.prepare("DELETE FROM recovery_codes WHERE user_id = ?").bind(user.id),
  ]);
  await audit(ctx, { action: "user.mfa_disabled", severity: "warning" });
  ctx.waitUntil(
    notify(ctx.env, {
      userId: user.id,
      type: "security.mfa",
      title: "Two-factor authentication disabled",
      link: "/settings?tab=security",
      forceEmail: true,
      email: templates.announcement(ctx.env, "Two-factor authentication disabled", "<p>Two-factor authentication was turned off for your account. If this wasn't you, secure your account immediately.</p>"),
    }),
  );
  return json({ ok: true });
}, { auth: true });

authRoutes.post("/api/auth/2fa/recovery-codes", async (ctx) => {
  const user = requireUser(ctx);
  if (!user.totp_enabled) throw badRequest("Enable two-factor authentication first.", "mfa_not_enabled");
  const codes = Array.from({ length: 10 }, () => randomCode(10));
  await ctx.env.DB.batch([
    ctx.env.DB.prepare("DELETE FROM recovery_codes WHERE user_id = ?").bind(user.id),
    ...(await Promise.all(
      codes.map(async (code) =>
        ctx.env.DB.prepare("INSERT INTO recovery_codes(id, user_id, code_hash) VALUES(?, ?, ?)").bind(id(), user.id, await sha256Hex(code)),
      ),
    )),
  ]);
  await audit(ctx, { action: "user.mfa_recovery_regenerated", severity: "warning" });
  return json({ recovery_codes: codes });
}, { auth: true });

/* ------------------------------------------------------- identities */

authRoutes.get("/api/auth/identities", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(ctx.env, "SELECT id, provider, email, display_name, avatar_url, created_at FROM user_identities WHERE user_id = ?", user.id);
  return json({ identities: rows });
}, { auth: true });

authRoutes.delete("/api/auth/identities/:id", async (ctx) => {
  const user = requireUser(ctx);
  const passwordRow = await first<{ password_hash: string }>(ctx.env, "SELECT password_hash FROM users WHERE id = ?", user.id);
  const identityCount = await first<{ value: number }>(ctx.env, "SELECT count(*) AS value FROM user_identities WHERE user_id = ?", user.id);
  if (!passwordRow?.password_hash && Number(identityCount?.value ?? 0) <= 1) {
    throw conflict("Set a password before removing your only sign-in method.", "last_login_method");
  }
  const result = await run(ctx.env, "DELETE FROM user_identities WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!result.meta.changes) throw notFound("Identity not found.");
  await audit(ctx, { action: "user.identity_removed", resourceId: ctx.params.id });
  return noContent();
}, { auth: true });

/* ------------------------------------------------------- onboarding */

authRoutes.post("/api/auth/onboarding/complete", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ goals?: string[]; role?: string }>(ctx.request).catch(() => ({}) as { goals?: string[]; role?: string });
  const settings = { ...user.settings, onboarding: { goals: payload.goals ?? [], role: payload.role ?? null, completedAt: now() } };
  await run(ctx.env, "UPDATE users SET onboarded_at = ?, settings = ?, updated_at = ? WHERE id = ?", now(), JSON.stringify(settings), now(), user.id);
  await audit(ctx, { action: "user.onboarded" });
  ctx.waitUntil(dispatch(ctx.env, user.id, "user.updated", { id: user.id, onboarded: true }));
  return json({ ok: true });
}, { auth: true });

/** Aggregated onboarding checklist used by the dashboard. */
authRoutes.get("/api/auth/onboarding", async (ctx) => {
  const user = requireUser(ctx);
  const row = await first<{ providers: number; files: number; shares: number; keys: number }>(
    ctx.env,
    `SELECT
      (SELECT count(*) FROM storage_providers WHERE user_id = ?1) AS providers,
      (SELECT count(*) FROM files WHERE user_id = ?1 AND deleted_at IS NULL) AS files,
      (SELECT count(*) FROM file_shares WHERE owner_id = ?1) + (SELECT count(*) FROM public_links WHERE owner_id = ?1) AS shares,
      (SELECT count(*) FROM api_keys WHERE user_id = ?1 AND revoked_at IS NULL) AS keys`,
    user.id,
  );
  const steps = [
    { id: "verify_email", label: "Verify your email address", done: Boolean(user.email_verified_at), href: "/settings?tab=profile" },
    { id: "connect_provider", label: "Connect a cloud provider", done: Number(row?.providers ?? 0) > 0, href: "/providers" },
    { id: "add_files", label: "Upload or import your first file", done: Number(row?.files ?? 0) > 0, href: "/files" },
    { id: "share", label: "Share something with a link", done: Number(row?.shares ?? 0) > 0, href: "/files" },
    { id: "secure", label: "Turn on two-factor authentication", done: user.totp_enabled, href: "/settings?tab=security" },
    { id: "api", label: "Create an API key (optional)", done: Number(row?.keys ?? 0) > 0, href: "/api-keys", optional: true },
  ];
  const required = steps.filter((step) => !step.optional);
  return json({
    steps,
    completed: required.filter((step) => step.done).length,
    total: required.length,
    dismissed: Boolean(user.onboarded_at),
  });
}, { auth: true });

export const parseSettings = (value: string | null) => parseJson<Record<string, unknown>>(value, {});
