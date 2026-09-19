/**
 * HTTP helpers: typed JSON responses, a single error shape, cookies, CORS and
 * request parsing. Every error leaving the API looks the same:
 *   { "error": "human readable", "code": "machine_readable", "requestId": "req_…" }
 */

import type { Env, RequestContext } from "../types";

export type JsonValue = unknown;

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

export function json(data: JsonValue, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data ?? null), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers as Record<string, string> | undefined) },
  });
}

export function created(data: JsonValue): Response {
  return json(data, { status: 201 });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

export interface ApiErrorBody {
  error: string;
  code: string;
  requestId?: string;
  details?: unknown;
}

export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "unsupported_media_type"
  | "unprocessable"
  | "rate_limited"
  | "quota_exceeded"
  | "maintenance_mode"
  | "internal_error";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  unsupported_media_type: 415,
  unprocessable: 422,
  rate_limited: 429,
  quota_exceeded: 507,
  maintenance_mode: 503,
  internal_error: 500,
};

/** An error that is safe to show to the person who caused it. */
export class ApiError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;
  headers?: Record<string, string>;

  constructor(code: ErrorCode, message: string, details?: unknown, headers?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
    this.headers = headers;
  }

  toResponse(requestId: string): Response {
    const body: ApiErrorBody = { error: this.message, code: this.code, requestId };
    if (this.details !== undefined) body.details = this.details;
    return json(body, { status: this.status, headers: this.headers });
  }
}

export const badRequest = (message: string, details?: unknown) => new ApiError("bad_request", message, details);
export const unauthorized = (message = "You need to sign in to do that.") => new ApiError("unauthorized", message);
export const forbidden = (message = "You do not have access to that.") => new ApiError("forbidden", message);
export const notFound = (message = "Not found.") => new ApiError("not_found", message);
export const conflict = (message: string) => new ApiError("conflict", message);
export const payloadTooLarge = (message: string) => new ApiError("payload_too_large", message);
export const unprocessable = (message: string, details?: unknown) => new ApiError("unprocessable", message, details);
export const rateLimited = (message: string, retryAfterSeconds: number) =>
  new ApiError("rate_limited", message, { retryAfter: retryAfterSeconds }, { "retry-after": String(retryAfterSeconds) });
export const quotaExceeded = (message: string) => new ApiError("quota_exceeded", message);

/** Wraps an unexpected failure so internals never leak to the client. */
export function internalError(context: string, cause: unknown): ApiError {
  console.error(`[${context}]`, cause instanceof Error ? cause.stack ?? cause.message : cause);
  return new ApiError("internal_error", "Something went wrong on our side. Please try again.", { context });
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

export interface CookieOptions {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  domain?: string;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path ?? "/"}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.secure !== false) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite ?? "Lax"}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  return parts.join("; ");
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(raw);
    } catch {
      out[name] = raw;
    }
  }
  return out;
}

/** Secure cookies are only meaningful over HTTPS; localhost would drop them. */
export function cookieSecure(env: Env, url: URL): boolean {
  if (url.protocol === "https:") return true;
  return env.ENVIRONMENT === "production";
}

// ---------------------------------------------------------------------------
// CORS + security headers
// ---------------------------------------------------------------------------

export function allowedOrigins(env: Env): string[] {
  return (env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = allowedOrigins(env);
  // Same-origin requests (the normal case through the Vercel rewrite) need no CORS.
  const isAllowed = allowed.includes(origin) || allowed.includes("*") || origin === new URL(env.APP_URL || "http://localhost").origin;
  if (!isAllowed) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-api-key,authorization,range,x-file-name",
    "access-control-expose-headers": "content-range,content-length,etag,x-request-id",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function withCommonHeaders(response: Response, requestId: string, extra: Record<string, string> = {}): Response {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// ---------------------------------------------------------------------------
// Request parsing
// ---------------------------------------------------------------------------

export async function readJson<T = Record<string, unknown>>(req: Request, limit = 256 * 1024): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared && declared > limit) throw payloadTooLarge("That request body is too large.");
  const text = await req.text();
  if (!text) return {} as T;
  if (text.length > limit) throw payloadTooLarge("That request body is too large.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest("That request body is not valid JSON.");
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return null;
  return token.trim();
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

export function userAgent(req: Request): string {
  return (req.headers.get("user-agent") ?? "unknown").slice(0, 300);
}

/** Escapes a filename for the `Content-Disposition` header (RFC 5987). */
export function contentDisposition(name: string, kind: "inline" | "attachment" = "attachment"): string {
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

export function redirect(url: string, status = 302): Response {
  return new Response(null, { status, headers: { location: url } });
}

export function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

export function xml(body: string): Response {
  return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8" } });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Normalises a pathname: no trailing slash (except root), decoded segments. */
export function normalisePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

export function idempotencyKey(req: Request): string | null {
  return req.headers.get("idempotency-key")?.slice(0, 120) ?? null;
}

export type Ctx = RequestContext;
