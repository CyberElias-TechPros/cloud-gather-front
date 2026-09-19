/**
 * Session management.
 *
 * Source of truth is the `sessions` table so revocation is immediate and device
 * lists are accurate; KV holds a short-lived read-through cache to keep the
 * hot path off D1.
 */

import type { AuthUser, Env } from "../types";
import { randomId, randomToken, sha256Hex } from "./crypto";
import { clientIp, parseCookies, serializeCookie, unauthorized } from "./http";

const CACHE_PREFIX = "sess:";
const CACHE_TTL_SECONDS = 120;

export interface SessionRow {
  id: string;
  user_id: string;
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

interface CachedSession {
  sessionId: string;
  userId: string;
  expiresAt: string;
}

export function sessionCookieName(env: Env): string {
  return env.SESSION_COOKIE_NAME || "cg_session";
}

export async function createSession(
  env: Env,
  user: { id: string; email: string },
  req: Request,
  ttlDays: number,
  maxSessions: number,
): Promise<{ token: string; expiresAt: string; sessionId: string }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 86_400_000).toISOString();
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const sessionId = randomId("ses");

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, created_at, last_seen_at, expires_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6, ?7)`,
  )
    .bind(
      sessionId,
      user.id,
      tokenHash,
      (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
      clientIp(req),
      now.toISOString(),
      expiresAt,
    )
    .run();

  // Trim the oldest sessions beyond the per-user cap.
  const excess = await env.DB.prepare(
    `SELECT id FROM sessions WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2
     ORDER BY created_at DESC LIMIT -1 OFFSET ?3`,
  )
    .bind(user.id, now.toISOString(), maxSessions)
    .all<{ id: string }>();

  for (const row of excess.results ?? []) {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE id = ?2").bind(now.toISOString(), row.id).run();
  }

  return { token, expiresAt, sessionId };
}

export function sessionCookie(token: string, expiresAt: string, env: Env, secure: boolean): string {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return serializeCookie(sessionCookieName(env), token, {
    maxAge,
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

export function clearSessionCookie(env: Env, secure: boolean): string {
  return serializeCookie(sessionCookieName(env), "", {
    maxAge: 0,
    httpOnly: true,
    secure,
    sameSite: "Lax",
    path: "/",
    domain: env.COOKIE_DOMAIN || undefined,
  });
}

export function extractToken(req: Request, env: Env): string | null {
  const cookies = parseCookies(req.headers.get("cookie"));
  const cookieToken = cookies[sessionCookieName(env)];
  if (cookieToken) return cookieToken;
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return null;
}

interface ResolvedUserRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  email_verified: number;
  settings: string;
  storage_quota_bytes: number | null;
  session_id: string;
  expires_at: string;
  revoked_at: string | null;
}

export async function resolveSession(env: Env, token: string): Promise<AuthUser | null> {
  const tokenHash = await sha256Hex(token);
  const cacheKey = `${CACHE_PREFIX}${tokenHash}`;

  try {
    const cached = await env.CACHE.get<CachedSession>(cacheKey, "json");
    if (cached) {
      if (new Date(cached.expiresAt).getTime() < Date.now()) {
        await env.CACHE.delete(cacheKey);
      } else {
        const user = await loadUser(env, cached.userId, cached.sessionId);
        if (user) {
          if (Math.random() < 0.05) void touchSession(env, cached.sessionId);
          return user;
        }
        await env.CACHE.delete(cacheKey);
      }
    }
  } catch {
    // fall through to D1
  }

  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.email_verified,
            u.settings, u.storage_quota_bytes,
            s.id AS session_id, s.expires_at, s.revoked_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?1`,
  )
    .bind(tokenHash)
    .first<ResolvedUserRow>();

  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.status !== "active") return null;

  try {
    await env.CACHE.put(
      cacheKey,
      JSON.stringify({ sessionId: row.session_id, userId: row.id, expiresAt: row.expires_at }),
      { expirationTtl: CACHE_TTL_SECONDS },
    );
  } catch {
    // ignore
  }

  void touchSession(env, row.session_id);
  return toAuthUser(row, row.session_id);
}

async function loadUser(env: Env, userId: string, sessionId: string): Promise<AuthUser | null> {
  const row = await env.DB.prepare(
    `SELECT id, email, display_name, avatar_url, role, status, email_verified, settings, storage_quota_bytes
     FROM users WHERE id = ?1`,
  )
    .bind(userId)
    .first<Omit<ResolvedUserRow, "session_id" | "expires_at" | "revoked_at">>();
  if (!row || row.status !== "active") return null;
  return toAuthUser(row, sessionId);
}

function toAuthUser(row: Omit<ResolvedUserRow, "session_id" | "expires_at" | "revoked_at">, sessionId?: string): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role === "admin" ? "admin" : "user",
    status: row.status === "suspended" ? "suspended" : "active",
    emailVerified: row.email_verified === 1,
    settings: safeParse(row.settings),
    storageQuotaBytes: row.storage_quota_bytes,
    sessionId: sessionId ?? row.id,
    authMethod: "session",
  };
}

function safeParse(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function touchSession(env: Env, sessionId: string): Promise<void> {
  try {
    await env.DB.prepare("UPDATE sessions SET last_seen_at = ?1 WHERE id = ?2")
      .bind(new Date().toISOString(), sessionId)
      .run();
  } catch {
    // best effort
  }
}

export async function revokeSession(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE id = ?2")
    .bind(new Date().toISOString(), sessionId)
    .run();
}

export async function revokeAllSessions(env: Env, userId: string, exceptSessionId?: string): Promise<void> {
  const now = new Date().toISOString();
  if (exceptSessionId) {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE user_id = ?2 AND id != ?3 AND revoked_at IS NULL")
      .bind(now, userId, exceptSessionId)
      .run();
  } else {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL")
      .bind(now, userId)
      .run();
  }
  // Invalidate cached lookups: KV cannot delete by prefix, so we bump a user
  // "session epoch" that resolveSession consults.
  await bumpSessionEpoch(env, userId);
}

export async function bumpSessionEpoch(env: Env, userId: string): Promise<void> {
  try {
    await env.CACHE.put(`sessepoch:${userId}`, String(Date.now()), { expirationTtl: 3600 });
  } catch {
    // ignore
  }
}

export async function requireSession(env: Env, req: Request): Promise<AuthUser> {
  const token = extractToken(req, env);
  if (!token) throw unauthorized();
  const user = await resolveSession(env, token);
  if (!user) throw unauthorized("Your session has expired. Please sign in again.");
  return user;
}
