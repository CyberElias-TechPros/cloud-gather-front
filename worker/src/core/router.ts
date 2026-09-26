/**
 * Minimal, dependency-free router with a middleware pipeline.
 *
 * Deliberately avoids URLPattern so the matcher is unit-testable in plain Node
 * and behaves identically across runtimes.
 */
import type { Ctx } from "./context";
import { authenticate, requireAdmin, requireScope, requireVerifiedEmail } from "./context";
import { HttpError, notFound } from "./http";
import { enforce, rateLimitHeaders } from "./ratelimit";

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

export interface RouteOptions {
  /** Require an authenticated caller. */
  auth?: boolean;
  /** Require role = admin (implies auth). */
  admin?: boolean;
  /** API-key scope required when authenticated with X-API-Key. */
  scope?: "read" | "write" | "share" | "admin";
  /** Require a verified email when the instance enforces verification. */
  verified?: boolean;
  /** Per-identity fixed-window limit for this route. */
  rateLimit?: { limit: number; windowSeconds: number; by?: "ip" | "user" | "both" };
  /** Route stays reachable while maintenance mode is on. */
  maintenanceSafe?: boolean;
  /** Human description, surfaced in the generated OpenAPI document. */
  summary?: string;
  /** Hide from the public API document. */
  internal?: boolean;
}

interface CompiledRoute extends RouteOptions {
  method: string;
  path: string;
  segments: string[];
  handler: Handler;
}

export interface RouteMatch {
  route: CompiledRoute;
  params: Record<string, string>;
}

export class Router {
  private routes: CompiledRoute[] = [];

  add(method: string, path: string, handler: Handler, options: RouteOptions = {}): this {
    this.routes.push({
      ...options,
      method: method.toUpperCase(),
      path,
      segments: path.split("/").filter(Boolean),
      handler,
      auth: options.admin ? true : options.auth,
    });
    return this;
  }

  get = (path: string, handler: Handler, options?: RouteOptions) => this.add("GET", path, handler, options);
  post = (path: string, handler: Handler, options?: RouteOptions) => this.add("POST", path, handler, options);
  put = (path: string, handler: Handler, options?: RouteOptions) => this.add("PUT", path, handler, options);
  patch = (path: string, handler: Handler, options?: RouteOptions) => this.add("PATCH", path, handler, options);
  delete = (path: string, handler: Handler, options?: RouteOptions) => this.add("DELETE", path, handler, options);

  /** Merges another router (used to compose route modules). */
  use(other: Router): this {
    this.routes.push(...other.all());
    return this;
  }

  all(): CompiledRoute[] {
    return this.routes;
  }

  match(method: string, pathname: string): RouteMatch | null {
    const parts = pathname.split("/").filter(Boolean);
    const wanted = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase();
    for (const route of this.routes) {
      if (route.method !== wanted) continue;
      const params = matchSegments(route.segments, parts);
      if (params) return { route, params };
    }
    return null;
  }

  /** True when the path exists but with a different method (405 vs 404). */
  methodsFor(pathname: string): string[] {
    const parts = pathname.split("/").filter(Boolean);
    return this.routes.filter((route) => matchSegments(route.segments, parts) !== null).map((route) => route.method);
  }

  async handle(ctx: Ctx): Promise<Response> {
    const found = this.match(ctx.request.method, normalizePath(ctx.url.pathname));
    if (!found) {
      const methods = this.methodsFor(normalizePath(ctx.url.pathname));
      if (methods.length) throw new HttpError(405, `Method not allowed. Try: ${[...new Set(methods)].join(", ")}.`, "method_not_allowed");
      throw notFound("This API route does not exist.", "route_not_found");
    }

    ctx.params = found.params;
    const { route } = found;

    if (ctx.settings.maintenance_mode && !route.maintenanceSafe) {
      await authenticate(ctx, false);
      if (ctx.user?.role !== "admin") {
        throw new HttpError(503, ctx.settings.maintenance_message || "CloudGather is temporarily unavailable.", "maintenance_mode");
      }
    }

    if (route.auth) await authenticate(ctx, true);
    else await authenticate(ctx, false);

    if (route.admin) requireAdmin(ctx);
    if (route.scope) requireScope(ctx, route.scope);
    if (route.verified) requireVerifiedEmail(ctx);

    if (route.rateLimit) {
      const scopeKey =
        route.rateLimit.by === "user" && ctx.user
          ? `u:${ctx.user.id}`
          : route.rateLimit.by === "both" && ctx.user
            ? `u:${ctx.user.id}:${ctx.ip}`
            : `ip:${ctx.ip}`;
      const result = await enforce(ctx.env, `${route.method}${route.path}:${scopeKey}`, route.rateLimit.limit, route.rateLimit.windowSeconds);
      Object.assign(ctx.extraHeaders, rateLimitHeaders(result));
    } else if (ctx.apiKeyId) {
      const limit = Number(ctx.settings.api_rate_limit_per_minute) || 120;
      const result = await enforce(ctx.env, `key:${ctx.apiKeyId}`, limit, 60);
      Object.assign(ctx.extraHeaders, rateLimitHeaders(result));
    }

    return route.handler(ctx);
  }
}

/** Returns path params when the pattern matches, otherwise null. */
export function matchSegments(pattern: string[], parts: string[]): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let index = 0; index < pattern.length; index += 1) {
    const segment = pattern[index];
    if (segment === "*") {
      params["*"] = parts.slice(index).join("/");
      return params;
    }
    const value = parts[index];
    if (value === undefined) return null;
    if (segment.startsWith(":")) {
      params[segment.slice(1)] = decodeURIComponent(value);
      continue;
    }
    if (segment !== value) return null;
  }
  return pattern.length === parts.length ? params : null;
}

/** `/api/v1/files` and `/api/files` address the same handlers. */
export function normalizePath(pathname: string): string {
  const cleaned = pathname.replace(/\/+$/, "") || "/";
  return cleaned.replace(/^\/api\/v1(\/|$)/, "/api$1");
}
