/**
 * Cross-cutting middleware: request context, CORS, maintenance gate, auth guards,
 * rate limiting and API-key (developer API) authentication.
 */

import type { AuthUser, Env, Middleware, RouteContext } from "../types";
import {
  HttpError,
  clientIp,
  corsHeaders,
  forbidden,
  json,
  unauthorized,
} from "../lib/http";
import { sha256Hex } from "../lib/crypto";
import { enforceRateLimit } from "../lib/ratelimit";
import { loadSettings } from "../lib/settings";
import { extractToken, resolveSession } from "../lib/session";
import { recordUsage } from "../lib/events";

function allowedOrigins(env: Env): string[] {
  return (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Global middleware: request id, CORS, security headers, error boundary. */
export const requestContext: Middleware = async (ctx, next) => {
  const origin = ctx.req.headers.get("origin");
  const cors = corsHeaders(origin, allowedOrigins(ctx.env));

  if (ctx.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  let response: Response;
  try {
    response = await next();
  } catch (error) {
    const { errorResponse } = await import("../lib/http");
    response = errorResponse(error, ctx.requestId);
  }

  const headers = new Headers(response.headers);
  headers.set("x-request-id", ctx.requestId);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "no-referrer");
  for (const [key, value] of cors.entries()) headers.set(key, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/** Blocks mutating traffic while maintenance mode is on (admins still get through). */
export const maintenanceGate: Middleware = async (ctx, next) => {
  const settings = await loadSettings(ctx.env);
  if (!settings.maintenance_mode) return next();
  if (ctx.url.pathname.startsWith("/api/public") || ctx.url.pathname.startsWith("/api/health")) return next();
  throw new HttpError(
    503,
    `${settings.app_name} is briefly offline for maintenance. Please try again in a few minutes.`,
    "maintenance_mode",
  );
};

/** Populates ctx.user when a valid session or developer API key is present. */
export const attachUser: Middleware = async (ctx, next) => {
  try {
    const token = extractToken(ctx.req, ctx.env);
    if (token) {
      const user = await resolveSession(ctx.env, token);
      if (user) ctx.user = user;
    }
    if (!ctx.user) {
      const apiKey = ctx.req.headers.get("x-api-key");
      if (apiKey) {
        const principal = await resolveApiKey(ctx.env, apiKey);
        if (principal) {
          ctx.user = principal;
          const remaining = await enforceRateLimit(
            ctx.env,
            "api",
            principal.apiKeyId ?? "unknown",
            await apiKeyLimit(ctx.env),
            60,
          );
          ctx.state.rateLimitRemaining = remaining.remaining;
          ctx.waitUntil(
            recordUsage(ctx.env, principal.id, { api_calls: 1 }).catch(() => undefined),
          );
        }
      }
    }
  } catch (error) {
    if (error instanceof HttpError) throw error;
    // Auth lookups must never 500 the app — treat as anonymous.
    console.error(JSON.stringify({ level: "warn", message: "attachUser failed", error: String(error) }));
  }
  return next();
};

async function apiKeyLimit(env: Env): Promise<number> {
  const settings = await loadSettings(env);
  return settings.api_rate_limit_per_minute;
}

export async function resolveApiKey(env: Env, presented: string): Promise<AuthUser | null> {
  const trimmed = presented.trim();
  if (!trimmed || trimmed.length < 12) return null;
  const hash = await sha256Hex(trimmed);
  const row = await env.DB.prepare(
    `SELECT k.id AS key_id, k.permissions, k.expires_at, k.revoked_at,
            u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.email_verified,
            u.settings, u.storage_quota_bytes
     FROM api_keys k JOIN users u ON u.id = k.user_id
     WHERE k.key_hash = ?1`,
  )
    .bind(hash)
    .first<{
      key_id: string;
      permissions: string;
      expires_at: string | null;
      revoked_at: string | null;
      id: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      role: string;
      status: string;
      email_verified: number;
      settings: string;
      storage_quota_bytes: number | null;
    }>();

  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return null;
  if (row.status !== "active") return null;

  let permissions: string[] = [];
  try {
    const parsed = JSON.parse(row.permissions);
    if (Array.isArray(parsed)) permissions = parsed.map(String);
  } catch {
    permissions = [];
  }

  await env.DB.prepare("UPDATE api_keys SET last_used_at = ?1, request_count = request_count + 1 WHERE id = ?2")
    .bind(new Date().toISOString(), row.key_id)
    .run();

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    role: row.role === "admin" ? "admin" : "user",
    status: "active",
    emailVerified: row.email_verified === 1,
    settings: {},
    storageQuotaBytes: row.storage_quota_bytes,
    authMethod: "api-key",
    apiKeyPermissions: permissions,
    apiKeyId: row.key_id,
  };
}

/** Requires an authenticated session (cookies or Bearer token). */
export const requireAuth: Middleware = async (ctx, next) => {
  if (!ctx.user) throw unauthorized();
  return next();
};

/** Middleware wrapper around the session resolver (sets ctx.user). */
export const requireUser: Middleware = async (ctx, next) => {
  const { requireSession } = await import("../lib/session");
  ctx.user = await requireSession(ctx.env, ctx.req);
  return next();
};

/** Requires an authenticated session — developer API keys are not accepted. */
export const requireSessionAuth: Middleware = async (ctx, next) => {
  if (!ctx.user) throw unauthorized();
  if (ctx.user.authMethod !== "session") {
    throw forbidden("This endpoint requires a signed-in session, not an API key.");
  }
  return next();
};

export const requireAdmin: Middleware = async (ctx, next) => {
  if (!ctx.user) throw unauthorized();
  if (ctx.user.role !== "admin") throw forbidden("Administrator access is required.");
  return next();
};

/** Requires an authenticated principal with the given developer-API scope. */
export function requireScope(scope: "read" | "write" | "share"): Middleware {
  return async (ctx, next) => {
    if (!ctx.user) throw unauthorized();
    if (ctx.user.authMethod === "api-key") {
      const permissions = ctx.user.apiKeyPermissions ?? [];
      if (!permissions.includes(scope)) {
        throw forbidden(`This API key does not include the "${scope}" permission.`);
      }
    }
    return next();
  };
}

export function rateLimit(
  bucket: string,
  limit: number | "settings.auth" | "settings.upload" | "settings.api",
  windowSeconds = 60,
): Middleware {
  return async (ctx, next) => {
    const settings = await loadSettings(ctx.env);
    const resolvedLimit =
      limit === "settings.auth"
        ? settings.auth_rate_limit_per_minute
        : limit === "settings.upload"
          ? settings.upload_rate_limit_per_minute
          : limit === "settings.api"
            ? settings.api_rate_limit_per_minute
            : limit;
    const subject = ctx.user?.id ?? clientIp(ctx.req) ?? "anonymous";
    const result = await enforceRateLimit(ctx.env, bucket, subject, resolvedLimit, windowSeconds);
    const response = await next();
    const headers = new Headers(response.headers);
    headers.set("x-ratelimit-remaining", String(result.remaining));
    return new Response(response.body, { status: response.status, headers });
  };
}

export function requestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Small helper for handlers that want a JSON body typed as an object. */
export async function bodyOf<T>(ctx: RouteContext): Promise<T> {
  const { readJson } = await import("../lib/http");
  return readJson<T>(ctx.req);
}

export { json };
