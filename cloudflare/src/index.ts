/**
 * CloudGather API — Cloudflare Worker entry point.
 *
 * Deployment shape:
 *   Vercel (static SPA) ──/api/*──▶ this Worker ──▶ D1 · R2 · KV · Queues · Cron
 *
 * The frontend always talks to a same-origin `/api` path, so sessions ride in
 * httpOnly cookies with no CORS surface in production.
 */

import type { Env, JobMessage, RouteContext } from "./types";
import { Router } from "./lib/router";
import { errorResponse, json, notFound } from "./lib/http";
import { handleJob } from "./lib/events";
import { runScheduled } from "./lib/maintenance";
import { attachUser, maintenanceGate, requestContext, requestId } from "./middleware";
import { authRoutes } from "./routes/auth";
import { fileRoutes } from "./routes/files";
import { shareRoutes } from "./routes/shares";
import { providerRoutes } from "./routes/providers";
import { keyRoutes } from "./routes/keys";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import { developerRoutes } from "./routes/developer";

const router = new Router();

router.use(requestContext, attachUser, maintenanceGate);

authRoutes(router);
fileRoutes(router);
shareRoutes(router);
providerRoutes(router);
keyRoutes(router);
adminRoutes(router);
publicRoutes(router);
developerRoutes(router);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health probe at the edge of the router so it never depends on middleware.
    if (url.pathname === "/" ) {
      return json({
        name: "CloudGather API",
        version: "1.0.0",
        environment: env.ENVIRONMENT,
        docs: `${env.APP_URL}/developers`,
        health: "/api/health",
      });
    }

    const match = router.match(request.method, url.pathname);
    if (!match) {
      return errorResponse(notFound(`No route matches ${request.method} ${url.pathname}`), requestId());
    }
    if (match.methodMismatch) {
      return json({ error: `Method ${request.method} is not allowed for ${url.pathname}`, code: "method_not_allowed" }, { status: 405 });
    }

    const routeCtx: RouteContext = {
      env,
      req: request,
      url,
      params: match.params,
      requestId: requestId(),
      waitUntil: (promise) => ctx.waitUntil(promise),
      state: {},
    };

    return router.dispatch(match, routeCtx);
  },

  /** Cron Triggers — see docs/DEPLOYMENT.md for the schedule rationale. */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runScheduled(env, event.cron).catch((error) => {
        console.error(JSON.stringify({ level: "error", message: "scheduled run failed", cron: event.cron, error: String(error) }));
      }),
    );
  },

  /** Queue consumer — transactional email, audit writes and usage rollups. */
  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await handleJob(env, message.body);
        message.ack();
      } catch (error) {
        console.error(
          JSON.stringify({ level: "error", message: "job failed", type: message.body?.type, error: String(error) }),
        );
        // Retries are safe: handleJob is idempotent via job_receipts.
        message.retry({ delaySeconds: Math.min(60, 5 * (message.attempts || 1)) });
      }
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;
