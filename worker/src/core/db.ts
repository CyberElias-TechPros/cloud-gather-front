/** Thin, typed helpers over D1 plus cursor/offset pagination utilities. */
import type { Env } from "../env";
import { clamp, toInt } from "./util";

export const first = <T = Record<string, unknown>>(env: Env, sql: string, ...args: unknown[]) =>
  env.DB.prepare(sql).bind(...args).first<T>();

export async function all<T = Record<string, unknown>>(env: Env, sql: string, ...args: unknown[]): Promise<T[]> {
  const result = await env.DB.prepare(sql).bind(...args).all<T>();
  return (result.results || []) as T[];
}

export const run = (env: Env, sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).run();

/** Reads the first column of the first row — alias it `value`, `total`, anything. */
export async function count(env: Env, sql: string, ...args: unknown[]): Promise<number> {
  const row = await first<Record<string, unknown>>(env, sql, ...args);
  if (!row) return 0;
  const [value] = Object.values(row);
  return Number(value ?? 0);
}

export async function exists(env: Env, sql: string, ...args: unknown[]): Promise<boolean> {
  return Boolean(await first(env, sql, ...args));
}

/** Runs statements in a single D1 batch (implicit transaction). */
export function batch(env: Env, statements: D1PreparedStatement[]) {
  if (!statements.length) return Promise.resolve([] as D1Result[]);
  return env.DB.batch(statements);
}

export const stmt = (env: Env, sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args);

export interface PageParams {
  limit: number;
  offset: number;
  page: number;
}

export function pageParams(url: URL, defaultLimit = 50, maxLimit = 200): PageParams {
  const limit = clamp(toInt(url.searchParams.get("limit"), defaultLimit) || defaultLimit, 1, maxLimit);
  const page = Math.max(1, toInt(url.searchParams.get("page"), 1) || 1);
  const offset = url.searchParams.has("offset")
    ? Math.max(0, toInt(url.searchParams.get("offset"), 0))
    : (page - 1) * limit;
  return { limit, offset, page };
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
  hasMore: boolean;
}

export function paged<T>(items: T[], total: number, params: PageParams): Paged<T> {
  return {
    items,
    total,
    limit: params.limit,
    offset: params.offset,
    page: params.page,
    pages: Math.max(1, Math.ceil(total / params.limit)),
    hasMore: params.offset + items.length < total,
  };
}

/** Whitelisted ORDER BY builder — never interpolate user input into SQL. */
export function orderBy(
  requested: string | null,
  allowed: Record<string, string>,
  fallbackKey: string,
  direction: string | null = "desc",
): string {
  const column = allowed[requested || ""] || allowed[fallbackKey];
  const dir = String(direction || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
  return `${column} ${dir}`;
}
