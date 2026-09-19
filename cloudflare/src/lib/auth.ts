/**
 * Sessions, password verification and the middleware that turns a request into
 * an authenticated user.
 *
 * Sessions are opaque 32-byte tokens in an httpOnly cookie; only the SHA-256
 * hash is stored, so a database leak cannot be replayed. API keys use the same
 * idea with a `cg_live_` prefix and per-key scopes.
 */

import {
  DUMMY_PASSWORD_HASH,
  base64urlDecode,
  checkPasswordStrength,
  hashPassword,
  newId,
  randomToken,
  sha256Hex,
  timingSafeEqual,
  verifyPassword,
  type PasswordHash,
} from "./crypto";
import { all, first, nowIso, run } from "./db";
import {
  ApiError,
  clientIp,
  cookieSecure,
  forbidden,
  serializeCookie,
  unauthorized,
  userAgent,
  type Ctx,
} from "./http";
import type { ApiKeyRow, AuthUser, Env, SessionRow, UserRow } from "../types";

export const SESSION_COOKIE = "cg_session";
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  status: "active" | "suspended";
  emailVerified: boolean;
  storageQuotaBytes: number;
  settings: Record<string, string>;
  createdAt: string;
  lastLoginAt: string | null;
}

export function toPublicUser(row: UserRow): PublicUser {
  let settings: Record<string, string> = {};
  try {
    settings = JSON.parse(row.settings || "{}") as Record<string, string>;
  } catch {
    settings = {};
  }
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role,
    status: row.status,
    emailVerified: Boolean(row.email_verified),
    storageQuotaBytes: row.storage_quota_bytes,
    settings,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

export type { PasswordHash };

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(
  env: Env,
  req: Request,
  user: UserRow,
  ttlDays: number,
  maxSessions: number,
): Promise<{ token: string; cookie: string; session: SessionRow }> {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  const id = newId("ses");

  await run(
    env.DB,
    `INSERT INTO sessions (id, user_id, token_hash, ip, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    tokenHash,
    clientIp(req),
    userAgent(req),
    expiresAt,
  );

  await pruneOldSessions(env, user.id, maxSessions);

  const url = new URL(req.url);
  const cookie = serializeCookie(SESSION_COOKIE, token, {
    maxAge: ttlDays * 86_400,
    httpOnly: true,
    secure: cookieSecure(env, url),
    sameSite: "Lax",
    path: "/",
  });

  return {
    token,
    cookie,
    session: {
      id,
      user_id: user.id,
      token_hash: tokenHash,
      ip: clientIp(req),
      user_agent: userAgent(req),
      created_at: nowIso(),
      last_seen_at: nowIso(),
      expires_at: expiresAt,
      revoked_at: null,
    },
  };
}

/** Keeps only the newest `maxSessions` live sessions for a user. */
async function pruneOldSessions(env: Env, userId: string, maxSessions: number): Promise<void> {
  await run(
    env.DB,
    `UPDATE sessions SET revoked_at = ?
     WHERE user_id = ? AND revoked_at IS NULL AND id NOT IN (
       SELECT id FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC LIMIT ?
     )`,
    nowIso(),
    userId,
    userId,
    Math.max(1, maxSessions),
  );
}

export async function resolveSession(env: Env, req: Request): Promise<{ user: UserRow; session: SessionRow } | null> {
  const header = req.headers.get("cookie");
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await first<SessionRow & { user_id: string }>(
    env.DB,
    `SELECT * FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?`,
    tokenHash,
    nowIso(),
  );
  if (!row) return null;

  const user = await first<UserRow>(env.DB, `SELECT * FROM users WHERE id = ?`, row.user_id);
  if (!user || user.status === "suspended") return null;

  // Touch at most every few minutes to keep write volume sane.
  if (Date.now() - new Date(row.last_seen_at).getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await run(env.DB, `UPDATE sessions SET last_seen_at = ? WHERE id = ?`, nowIso(), row.id);
  }

  return { user, session: row };
}

export async function revokeSession(env: Env, sessionId: string, userId: string): Promise<boolean> {
  const result = await run(
    env.DB,
    `UPDATE sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    nowIso(),
    sessionId,
    userId,
  );
  return (result.meta.changes ?? 0) > 0;
}

export async function revokeOtherSessions(env: Env, userId: string, keepSessionId?: string): Promise<number> {
  const result = await run(
    env.DB,
    `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND id != ?`,
    nowIso(),
    userId,
    keepSessionId ?? "",
  );
  return result.meta.changes ?? 0;
}

export function clearSessionCookie(env: Env, url: URL): string {
  return serializeCookie(SESSION_COOKIE, "", {
    maxAge: 0,
    httpOnly: true,
    secure: cookieSecure(env, url),
    sameSite: "Lax",
    path: "/",
  });
}

export async function listSessions(env: Env, userId: string): Promise<SessionRow[]> {
  return all<SessionRow>(
    env.DB,
    `SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY last_seen_at DESC`,
    userId,
    nowIso(),
  );
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export async function authenticatePassword(env: Env, user: UserRow | null, password: string): Promise<UserRow | null> {
  const stored: PasswordHash = user
    ? { hash: user.password_hash, salt: user.password_salt, iterations: user.password_iterations, algorithm: "pbkdf2-sha256" }
    : DUMMY_PASSWORD_HASH;

  const valid = await verifyPassword(password, stored);
  if (!user || !valid) return null;

  // Opportunistically upgrade hashes created with a lower cost factor.
  const target = iterationsFromEnv(env);
  if (user.password_iterations < target) {
    const upgraded = await hashPassword(password, target);
    await run(
      env.DB,
      `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?`,
      upgraded.hash,
      upgraded.salt,
      upgraded.iterations,
      nowIso(),
      user.id,
    );
  }

  return user;
}

export async function setPassword(env: Env, userId: string, password: string): Promise<void> {
  const strength = checkPasswordStrength(password);
  if (!strength.valid) {
    throw new ApiError("unprocessable", strength.problems[0], { errors: strength.problems });
  }
  const hashed = await hashPassword(password, iterationsFromEnv(env));
  await run(
    env.DB,
    `UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?, updated_at = ? WHERE id = ?`,
    hashed.hash,
    hashed.salt,
    hashed.iterations,
    nowIso(),
    userId,
  );
}

export function iterationsFromEnv(env: Env): number {
  const configured = Number(env.PASSWORD_ITERATIONS);
  return Number.isFinite(configured) && configured >= 10_000 ? configured : 210_000;
}

export async function findUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return first<UserRow>(env.DB, `SELECT * FROM users WHERE email_normalized = ?`, email.trim().toLowerCase());
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The address in `ADMIN_EMAIL` is promoted on first sign-in. This avoids shipping
 * a default administrator password while still letting the operator in.
 */
export async function maybePromoteAdmin(env: Env, user: UserRow): Promise<UserRow> {
  const adminEmail = (env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!adminEmail || user.role === "admin" || user.email_normalized !== adminEmail) return user;
  await run(env.DB, `UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?`, nowIso(), user.id);
  console.log(`[auth] promoted ${user.email} to admin via ADMIN_EMAIL`);
  return { ...user, role: "admin" };
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export const API_KEY_PREFIX = "cg_live_";

export function generateApiKey(): { secret: string; prefix: string } {
  const secret = `${API_KEY_PREFIX}${randomToken(32)}`;
  return { secret, prefix: secret.slice(0, API_KEY_PREFIX.length + 6) };
}

export async function resolveApiKey(env: Env, token: string): Promise<{ user: UserRow; apiKey: ApiKeyRow } | null> {
  if (!token.startsWith(API_KEY_PREFIX)) return null;
  const keyHash = await sha256Hex(token);
  const key = await first<ApiKeyRow>(
    env.DB,
    `SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`,
    keyHash,
  );
  if (!key) return null;
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) return null;

  const user = await first<UserRow>(env.DB, `SELECT * FROM users WHERE id = ?`, key.user_id);
  if (!user || user.status === "suspended") return null;

  return { user, apiKey: key };
}

export function apiKeyScopes(key: ApiKeyRow): string[] {
  try {
    const parsed = JSON.parse(key.permissions) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    // fall through to the safe default
  }
  return ["read"];
}

export function requireScope(auth: AuthUser, scope: "read" | "write" | "share"): void {
  // Session-authenticated users own their data outright; only API keys are scoped.
  if (!auth.apiKey) return;
  const scopes = apiKeyScopes(auth.apiKey);
  if (!scopes.includes(scope)) {
    throw forbidden(`This API key is missing the "${scope}" scope.`);
  }
  if (auth.apiKey.expires_at && new Date(auth.apiKey.expires_at).getTime() < Date.now()) {
    throw unauthorized("This API key has expired.");
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export interface AuthenticatedCtx extends Ctx {
  auth: AuthUser;
}

/** Attaches `ctx.auth` when a session cookie is present. */
export async function withAuth(ctx: Ctx, next: () => Promise<Response>): Promise<Response> {
  const resolved = await resolveSession(ctx.env, ctx.req);
  if (resolved) {
    ctx.state.user = resolved.user;
    ctx.state.session = resolved.session;
    ctx.state.auth = { user: resolved.user, session: resolved.session } satisfies AuthUser;
  }
  return next();
}

/** Requires an authenticated session (cookie). */
export async function requireUser(ctx: Ctx, next: () => Promise<Response>): Promise<Response> {
  const auth = ctx.state.auth as AuthUser | undefined;
  if (!auth?.user) throw unauthorized();
  if (auth.user.status === "suspended") throw forbidden("This account is suspended.");
  return next();
}

export async function requireAdmin(ctx: Ctx, next: () => Promise<Response>): Promise<Response> {
  const auth = ctx.state.auth as AuthUser | undefined;
  if (!auth?.user) throw unauthorized();
  if (auth.user.role !== "admin") throw forbidden("Administrator access is required.");
  return next();
}

export function currentUser(ctx: Ctx): UserRow {
  const auth = ctx.state.auth as AuthUser | undefined;
  if (!auth?.user) throw unauthorized();
  return auth.user;
}
