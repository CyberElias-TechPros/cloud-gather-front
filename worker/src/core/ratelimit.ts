/**
 * Fixed-window rate limiting. Uses KV when the binding exists (cheap, global)
 * and falls back to a D1 counter table so a bare deployment is still protected.
 */
import type { Env } from "../env";
import { first, run } from "./db";
import { rateLimited } from "./http";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export async function consume(env: Env, bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const reset = windowStart + windowSeconds;
  const key = `rl:${bucket}:${windowStart}`;

  if (env.KV) {
    try {
      const currentRaw = await env.KV.get(key);
      const current = Number(currentRaw || 0) + 1;
      await env.KV.put(key, String(current), { expirationTtl: Math.max(60, windowSeconds * 2) });
      return { allowed: current <= limit, limit, remaining: Math.max(0, limit - current), reset };
    } catch {
      // fall through to D1
    }
  }

  try {
    await run(
      env,
      `INSERT INTO rate_limits(key, window_start, count, expires_at) VALUES(?, ?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET count = count + 1`,
      key,
      windowStart,
      reset,
    );
    const row = await first<{ count: number }>(env, "SELECT count FROM rate_limits WHERE key = ?", key);
    const current = Number(row?.count ?? 1);
    return { allowed: current <= limit, limit, remaining: Math.max(0, limit - current), reset };
  } catch {
    // Never let the limiter itself break the API.
    return { allowed: true, limit, remaining: limit, reset };
  }
}

export async function enforce(env: Env, bucket: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const result = await consume(env, bucket, limit, windowSeconds);
  if (!result.allowed) {
    throw rateLimited(`Too many requests. Try again in ${Math.max(1, result.reset - Math.floor(Date.now() / 1000))} seconds.`);
  }
  return result;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "x-ratelimit-limit": String(result.limit),
    "x-ratelimit-remaining": String(result.remaining),
    "x-ratelimit-reset": String(result.reset),
  };
}

/** Removes expired counters — called from the scheduled handler. */
export async function purgeExpired(env: Env): Promise<number> {
  const result = await run(env, "DELETE FROM rate_limits WHERE expires_at < ?", Math.floor(Date.now() / 1000));
  return result.meta.changes ?? 0;
}
