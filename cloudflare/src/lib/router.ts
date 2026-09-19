/**
 * Minimal router: static segments, `:params` and a trailing `*` catch-all.
 *
 * Handlers follow the familiar middleware shape `(ctx, next)`:
 *   * returning a Response short-circuits the chain;
 *   * calling `next()` continues to the next handler.
 *
 * Static segments beat parameters when both match, so `/files/tree` is never
 * swallowed by `/files/:id`.
 */

import { MethodMismatch, NotFound } from "./http-errors";
import type { Ctx } from "./http";

export interface Next {
  (): Promise<Response>;
}

export type Middleware = (ctx: Ctx, next: Next) => Promise<Response> | Response;
export type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface Route {
  method: string;
  pattern: string;
  segments: string[];
  chain: Middleware[];
  handler: Handler;
}

export interface MatchResult {
  route: Route | null;
  params: Record<string, string>;
  methodMismatch: boolean;
}

function buildChain(chain: Middleware[], handler: Handler) {
  return async (ctx: Ctx): Promise<Response> => {
    let index = -1;

    const dispatch = async (position: number): Promise<Response> => {
      if (position <= index) throw new Error("next() called twice in the same middleware");
      index = position;
      if (position >= chain.length) return handler(ctx);
      return chain[position](ctx, () => dispatch(position + 1));
    };

    return dispatch(0);
  };
}

export class Router {
  private routes: Route[] = [];
  private global: Middleware[] = [];

  use(...middleware: Middleware[]): this {
    this.global.push(...middleware);
    return this;
  }

  add(method: string, pattern: string, chain: Middleware[], handler: Handler): this {
    this.routes.push({
      method: method.toUpperCase(),
      pattern,
      segments: pattern.split("/").filter(Boolean),
      chain,
      handler,
    });
    return this;
  }

  get(pattern: string, ...rest: Array<Middleware | Handler>): this {
    return this.register("GET", pattern, rest);
  }
  post(pattern: string, ...rest: Array<Middleware | Handler>): this {
    return this.register("POST", pattern, rest);
  }
  patch(pattern: string, ...rest: Array<Middleware | Handler>): this {
    return this.register("PATCH", pattern, rest);
  }
  delete(pattern: string, ...rest: Array<Middleware | Handler>): this {
    return this.register("DELETE", pattern, rest);
  }
  options(pattern: string, ...rest: Array<Middleware | Handler>): this {
    return this.register("OPTIONS", pattern, rest);
  }

  /** The last argument is the handler; everything before it is middleware. */
  private register(method: string, pattern: string, rest: Array<Middleware | Handler>): this {
    const handler = rest[rest.length - 1] as Handler;
    const chain = rest.slice(0, -1) as Middleware[];
    return this.add(method, pattern, chain, handler);
  }

  /** Finds the best route for a request. */
  match(method: string, pathname: string): MatchResult | null {
    const parts = pathname.split("/").filter(Boolean);
    const upper = method.toUpperCase();
    let sawPath = false;
    let best: { route: Route; params: Record<string, string>; score: number } | null = null;

    for (const route of this.routes) {
      const params: Record<string, string> = {};
      let score = 0;
      let ok = true;
      let index = 0;

      for (let i = 0; i < route.segments.length; i++) {
        const segment = route.segments[i];
        if (segment === "*") {
          params["*"] = parts.slice(index).join("/");
          score += 1;
          index = parts.length;
          break;
        }
        const part = parts[index];
        if (part === undefined) {
          ok = false;
          break;
        }
        if (segment.startsWith(":")) {
          let decoded = part;
          try {
            decoded = decodeURIComponent(part);
          } catch {
            // Keep the raw segment when it is not valid percent-encoding.
          }
          params[segment.slice(1)] = decoded;
          score += 5;
        } else if (segment === part) {
          score += 10;
        } else {
          ok = false;
          break;
        }
        index += 1;
      }

      if (!ok || index !== parts.length) continue;
      sawPath = true;
      if (route.method !== upper) continue;
      if (!best || score > best.score) best = { route, params, score };
    }

    if (!best) return sawPath ? { route: null, params: {}, methodMismatch: true } : null;
    return { route: best.route, params: best.params, methodMismatch: false };
  }

  /** Runs the global chain, then the route chain, then the handler. */
  async dispatch(match: MatchResult, ctx: Ctx): Promise<Response> {
    if (match.methodMismatch || !match.route) throw new MethodMismatch();
    const route = match.route;
    ctx.params = { ...ctx.params, ...match.params };
    const composed = buildChain([...this.global, ...route.chain], route.handler);
    return composed(ctx);
  }
}

export { NotFound, MethodMismatch };
