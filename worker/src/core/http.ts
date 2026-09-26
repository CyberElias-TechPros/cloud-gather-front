/** HTTP plumbing: typed errors, JSON helpers, CORS and security headers. */
import type { Env } from "../env";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "error",
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, code = "bad_request", details?: unknown) => new HttpError(400, message, code, details);
export const unauthorized = (message = "Authentication required.", code = "unauthorized") => new HttpError(401, message, code);
export const forbidden = (message = "You do not have access to this resource.", code = "forbidden") => new HttpError(403, message, code);
export const notFound = (message = "Not found.", code = "not_found") => new HttpError(404, message, code);
export const conflict = (message: string, code = "conflict") => new HttpError(409, message, code);
export const tooLarge = (message: string, code = "payload_too_large") => new HttpError(413, message, code);
export const unprocessable = (message: string, code = "unprocessable", details?: unknown) => new HttpError(422, message, code, details);
export const rateLimited = (message = "Too many requests. Please slow down.", code = "rate_limited") => new HttpError(429, message, code);
export const unavailable = (message: string, code = "not_configured") => new HttpError(503, message, code);

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export const noContent = () => new Response(null, { status: 204 });

export function errorResponse(message: string, status = 400, requestId?: string, code = "error", details?: unknown): Response {
  return json({ error: { message, code, status, requestId, ...(details ? { details } : {}) } }, status);
}

/** Parses a JSON body, enforcing content-type and a size ceiling. */
export async function readJson<T>(request: Request, maxBytes = 1_000_000): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw badRequest("Expected application/json.", "unsupported_media_type");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw tooLarge("Request body is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw tooLarge("Request body is too large.");
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw badRequest("Invalid JSON body.", "invalid_json");
  }
}

export function allowedOrigins(env: Env): string[] {
  return (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isOriginAllowed(env: Env, origin: string | null): boolean {
  if (!origin) return false;
  const list = allowedOrigins(env);
  if (list.includes("*")) return true;
  if (list.includes(origin)) return true;
  // Wildcard subdomain entries, e.g. https://*.vercel.app
  return list.some((entry) => {
    if (!entry.includes("*")) return false;
    const pattern = new RegExp(`^${entry.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^.]+")}$`);
    return pattern.test(origin);
  });
}

export function corsHeaders(request: Request, env: Env): Headers {
  const origin = request.headers.get("origin");
  const headers = new Headers({
    vary: "Origin",
    "access-control-allow-headers": "Authorization, Content-Type, X-API-Key, X-Request-Id, X-CloudGather-Client, Idempotency-Key",
    "access-control-allow-methods": "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-expose-headers": "X-Request-Id, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Content-Disposition, Content-Range",
    "access-control-max-age": "86400",
  });
  if (isOriginAllowed(env, origin)) {
    headers.set("access-control-allow-origin", origin!);
    headers.set("access-control-allow-credentials", "true");
  }
  return headers;
}

export function withSecurityHeaders(response: Response, extra: Headers, requestId: string): Response {
  const output = new Response(response.body, response);
  extra.forEach((value, key) => output.headers.set(key, value));
  output.headers.set("x-request-id", requestId);
  output.headers.set("x-content-type-options", "nosniff");
  output.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  output.headers.set("x-frame-options", "DENY");
  if (!output.headers.has("cache-control")) output.headers.set("cache-control", "no-store");
  return output;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "0.0.0.0"
  );
}

export function userAgent(request: Request): string {
  return (request.headers.get("user-agent") || "unknown").slice(0, 255);
}

/** Best-effort geo label for the session/device list. */
export function requestLocation(request: Request): string | null {
  const cf = (request as Request & { cf?: IncomingRequestCfProperties }).cf;
  if (!cf) return null;
  const parts = [cf.city, cf.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function bearerToken(request: Request): string | null {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

/** Parses an HTTP Range header for partial downloads (video scrubbing, resumes). */
export function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;
  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return null;
  let start = startRaw ? Number(startRaw) : size - Number(endRaw);
  let end = endRaw && startRaw ? Number(endRaw) : size - 1;
  start = Math.max(0, start);
  end = Math.min(size - 1, end);
  if (start > end) return null;
  return { start, end };
}

export function contentDisposition(filename: string, inline = false): string {
  const fallback = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
