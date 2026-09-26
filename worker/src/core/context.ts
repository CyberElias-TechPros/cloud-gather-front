/** Per-request context plus credential resolution (session tokens and API keys). */
import type { Env } from "../env";
import { first, run } from "./db";
import { bearerToken, forbidden, unauthorized } from "./http";
import { sha256Hex } from "./crypto";
import { parseJson } from "./util";
import type { SystemSettings } from "./settings";

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "pending_deletion";

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: UserRole;
  status: UserStatus;
  plan: string;
  settings: Record<string, unknown>;
  email_verified_at: string | null;
  totp_enabled: boolean;
  storage_quota_bytes: number | null;
  onboarded_at: string | null;
  created_at: string;
}

export interface Ctx {
  env: Env;
  request: Request;
  url: URL;
  requestId: string;
  params: Record<string, string>;
  ip: string;
  userAgent: string;
  settings: SystemSettings;
  waitUntil: (promise: Promise<unknown>) => void;
  user: AuthUser | null;
  sessionId: string | null;
  apiKeyId: string | null;
  scopes: string[] | null;
  extraHeaders: Record<string, string>;
}

const USER_COLUMNS = `u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.plan, u.settings,
  u.email_verified_at, u.totp_enabled_at, u.storage_quota_bytes, u.onboarded_at, u.created_at`;

type UserRow = Omit<AuthUser, "settings" | "totp_enabled"> & { settings: string; totp_enabled_at: string | null };

const toAuthUser = (row: UserRow): AuthUser => ({
  id: row.id,
  email: row.email,
  display_name: row.display_name,
  avatar_url: row.avatar_url,
  role: row.role,
  status: row.status,
  plan: row.plan || "free",
  settings: parseJson<Record<string, unknown>>(row.settings, {}),
  email_verified_at: row.email_verified_at,
  // Enrolment only counts once a code has been verified (totp_enabled_at set).
  totp_enabled: Boolean(row.totp_enabled_at),
  storage_quota_bytes: row.storage_quota_bytes,
  onboarded_at: row.onboarded_at,
  created_at: row.created_at,
});

/** Public shape returned to clients — never leaks hashes or secrets. */
export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    role: user.role,
    status: user.status,
    plan: user.plan,
    settings: user.settings,
    email_verified: Boolean(user.email_verified_at),
    email_verified_at: user.email_verified_at,
    two_factor_enabled: user.totp_enabled,
    onboarded: Boolean(user.onboarded_at),
    created_at: user.created_at,
  };
}

export async function loadUserById(env: Env, userId: string): Promise<AuthUser | null> {
  const row = await first<UserRow>(env, `SELECT ${USER_COLUMNS} FROM users u WHERE u.id = ?`, userId);
  return row ? toAuthUser(row) : null;
}

export async function loadUserByEmail(env: Env, email: string): Promise<AuthUser | null> {
  const row = await first<UserRow>(env, `SELECT ${USER_COLUMNS} FROM users u WHERE u.email = ? COLLATE NOCASE`, email);
  return row ? toAuthUser(row) : null;
}

/**
 * Resolves the caller from either a session bearer token or an API key.
 * Returns silently when no credential is present and `required` is false.
 */
export async function authenticate(ctx: Ctx, required = true): Promise<void> {
  const token = bearerToken(ctx.request);
  const apiKey = ctx.request.headers.get("x-api-key");
  const credential = token || apiKey;
  if (!credential) {
    if (required) throw unauthorized();
    return;
  }

  const hashed = await sha256Hex(credential);

  if (token) {
    const row = await first<UserRow & { session_id: string }>(
      ctx.env,
      `SELECT ${USER_COLUMNS}, s.id AS session_id
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now')`,
      hashed,
    );
    if (!row) {
      if (required) throw unauthorized("Your session has expired. Please sign in again.", "session_expired");
      return;
    }
    ctx.user = toAuthUser(row);
    ctx.sessionId = row.session_id;
    ctx.waitUntil(
      run(ctx.env, "UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?", row.session_id).then(
        () => undefined,
        () => undefined,
      ),
    );
  } else {
    const row = await first<UserRow & { key_id: string; scopes: string; key_expires: string | null; revoked_at: string | null }>(
      ctx.env,
      `SELECT ${USER_COLUMNS}, k.id AS key_id, k.permissions AS scopes, k.expires_at AS key_expires, k.revoked_at
         FROM api_keys k JOIN users u ON u.id = k.user_id
        WHERE k.key_hash = ?`,
      hashed,
    );
    if (!row || row.revoked_at || (row.key_expires && row.key_expires < new Date().toISOString())) {
      if (required) throw unauthorized("API key is invalid, revoked or expired.", "invalid_api_key");
      return;
    }
    ctx.user = toAuthUser(row);
    ctx.apiKeyId = row.key_id;
    ctx.scopes = parseJson<string[]>(row.scopes, ["read"]);
    ctx.waitUntil(
      run(ctx.env, "UPDATE api_keys SET last_used_at = datetime('now'), use_count = use_count + 1 WHERE id = ?", row.key_id).then(
        () => undefined,
        () => undefined,
      ),
    );
  }

  if (ctx.user && ctx.user.status === "suspended") {
    throw forbidden("This account has been suspended. Contact support for help.", "account_suspended");
  }
}

export function requireUser(ctx: Ctx): AuthUser {
  if (!ctx.user) throw unauthorized();
  return ctx.user;
}

export function requireAdmin(ctx: Ctx): AuthUser {
  const user = requireUser(ctx);
  if (user.role !== "admin") throw forbidden("Administrator access required.", "admin_required");
  return user;
}

/** `write` implies `read`; `admin` implies everything. */
export function hasScope(ctx: Ctx, scope: string): boolean {
  if (!ctx.scopes) return true; // session-authenticated users are unscoped
  if (ctx.scopes.includes("admin") || ctx.scopes.includes("*")) return true;
  if (ctx.scopes.includes(scope)) return true;
  if (scope === "read" && ctx.scopes.includes("write")) return true;
  return false;
}

export function requireScope(ctx: Ctx, scope: string): void {
  if (!hasScope(ctx, scope)) throw forbidden(`This API key is missing the "${scope}" scope.`, "insufficient_scope");
}

/** Blocks unverified users from privileged writes when the policy demands it. */
export function requireVerifiedEmail(ctx: Ctx): void {
  const user = requireUser(ctx);
  if (!ctx.settings.require_email_verification) return;
  if (user.email_verified_at) return;
  throw forbidden("Verify your email address to continue.", "email_verification_required");
}
