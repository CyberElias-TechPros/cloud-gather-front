/**
 * Tiny D1 helper layer.
 *
 * D1's API is already close to what we need; these helpers add the three things
 * that would otherwise be copy-pasted everywhere: ISO timestamps, single-row
 * lookups and safe JSON columns.
 */

import type { Env } from "../types";

export const IDs = {
  user: "usr",
  session: "ses",
  token: "tok",
  provider: "prv",
  file: "fil",
  folder: "fld",
  share: "shr",
  apiKey: "key",
  audit: "aud",
  notification: "ntf",
  message: "msg",
  post: "pst",
  job: "job",
} as const;

/** ISO-8601 UTC with milliseconds — always parseable by `new Date()`. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function isoAfter(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function isoDaysAfter(days: number): string {
  return isoAfter(days * 86_400);
}

export function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function first<T>(db: D1Database, sql: string, ...bindings: unknown[]): Promise<T | null> {
  const row = await db.prepare(sql).bind(...bindings).first<T>();
  return row ?? null;
}

export async function all<T>(db: D1Database, sql: string, ...bindings: unknown[]): Promise<T[]> {
  const result = await db.prepare(sql).bind(...bindings).all<T>();
  return result.results ?? [];
}

export async function run(db: D1Database, sql: string, ...bindings: unknown[]): Promise<D1Result> {
  return db.prepare(sql).bind(...bindings).run();
}

/** Runs statements atomically. D1 rolls the batch back if any statement fails. */
export async function batch(db: D1Database, statements: D1PreparedStatement[]): Promise<D1Result[]> {
  if (statements.length === 0) return [];
  return db.batch(statements);
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

/** Truncates text so a hostile client cannot bloat the database. */
export function clip(value: unknown, max = 4000): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > max ? text.slice(0, max) : text;
}

/**
 * KV is a cache, never a source of truth: every helper degrades gracefully when
 * the namespace is unavailable or the value has expired.
 */
export async function cacheGet<T>(env: Env, key: string): Promise<T | null> {
  try {
    const value = await env.CACHE.get(key, "json");
    return (value as T) ?? null;
  } catch {
    return null;
  }
}

export async function cachePut(env: Env, key: string, value: unknown, ttlSeconds = 60): Promise<void> {
  try {
    await env.CACHE.put(key, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
  } catch {
    // Cache writes are best-effort.
  }
}

export async function cacheDelete(env: Env, ...keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => env.CACHE.delete(key)));
  } catch {
    // Best-effort.
  }
}

/** Distributed lock used to keep expensive maintenance jobs single-flight. */
export async function acquireLock(env: Env, name: string, ttlSeconds: number): Promise<boolean> {
  try {
    const existing = await env.CACHE.get(`lock:${name}`);
    if (existing) return false;
    await env.CACHE.put(`lock:${name}`, nowIso(), { expirationTtl: Math.max(60, ttlSeconds) });
    return true;
  } catch {
    // Without KV we cannot coordinate; proceed and rely on idempotent jobs.
    return true;
  }
}
