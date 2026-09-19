/**
 * Fixed-window rate limiting backed by D1.
 *
 * KV would be cheaper but is eventually consistent, which makes a limit easy to
 * overshoot by a factor of the number of colos involved. A single atomic
 * UPSERT in D1 gives exact counts with one round trip.
 */

import { nowIso } from "./db";
import { rateLimited } from "./http";
import type { Env } from "../types";

export interface RateLimitRule {
  /** Bucket namespace, e.g. "auth" or "api". */
  scope: string;
  /** Requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /** What identifies the caller: an IP, a user id or an API key hash. */
  identifier: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: string;
}

/**
 * Counts one hit against the rule and reports whether it is allowed.
 * Fails open: a database hiccup must not lock everybody out.
 */
export async function consumeRateLimit(env: Env, rule: RateLimitRule): Promise<RateLimitResult> {
  const windowStart = new Date(Math.floor(Date.now() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000);
  const expiresAt = new Date(windowStart.getTime() + rule.windowSeconds * 1000).toISOString();
  const key = `${rule.scope}:${rule.identifier}:${windowStart.getTime()}`;

  try {
    const row = await env.DB.prepare(
      `INSERT INTO rate_limits (key, count, window_start, expires_at)
       VALUES (?, 1, ?, ?)
       ON CONFLICT (key) DO UPDATE SET count = rate_limits.count + 1
       RETURNING count, expires_at`,
    )
      .bind(key, windowStart.toISOString(), expiresAt)
      .first<{ count: number; expires_at: string }>();

    const count = row?.count ?? 1;
    return {
      allowed: count <= rule.limit,
      remaining: Math.max(0, rule.limit - count),
      limit: rule.limit,
      resetAt: row?.expires_at ?? expiresAt,
    };
  } catch (error) {
    console.warn("[ratelimit] falling back to allow", error instanceof Error ? error.message : error);
    return { allowed: true, remaining: rule.limit, limit: rule.limit, resetAt: expiresAt };
  }
}

/** Throws a 429 with a `retry-after` header when the limit is exceeded. */
export async function enforceRateLimit(env: Env, rule: RateLimitRule, message: string): Promise<void> {
  const result = await consumeRateLimit(env, rule);
  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((new Date(result.resetAt).getTime() - Date.now()) / 1000));
    throw rateLimited(message, retryAfter);
  }
}

export async function rateLimitForApiKey(env: Env, keyId: string, limitPerMinute: number): Promise<RateLimitResult> {
  return consumeRateLimit(env, { scope: "api", limit: limitPerMinute, windowSeconds: 60, identifier: keyId });
}

/** Housekeeping: drop windows that have already closed. */
export async function pruneRateLimits(env: Env): Promise<number> {
  const result = await env.DB.prepare("DELETE FROM rate_limits WHERE expires_at < ?").bind(nowIso()).run();
  return result.meta.changes ?? 0;
}

export async function clearRateLimits(env: Env, scope: string): Promise<number> {
  const result = await env.DB.prepare("DELETE FROM rate_limits WHERE key LIKE ?").bind(`${scope}:%`).run();
  return result.meta.changes ?? 0;
}
