/**
 * CloudGather API — the Worker entry point.
 *
 *   fetch()      one router for everything under `/api`
 *   scheduled()  cron housekeeping (see lib/maintenance.ts)
 *   queue()      background jobs: e-mail delivery and drive imports
 *
 * The request pipeline is deliberately explicit: build the context, run the
 * global chain (session resolution, maintenance gate), match a route, dispatch,
 * then normalise every outcome — success, `ApiError`, 404, 405 or a crash — into
 * the same JSON shape with a request id attached.
 */

import { Router, type Next } from "./lib/router";
import { MethodMismatch, NotFound as RouteNotFound } from "./lib/http-errors";
import { ApiError, corsHeaders, json, withCommonHeaders, type Ctx } from "./lib/http";
import { requireAdmin, requireUser, withAuth } from "./lib/auth";
import { booleanSetting, getSettings, numericSetting } from "./lib/settings";
import { runScheduled } from "./lib/maintenance";
import { sendEmail, type EmailMessage } from "./lib/email";
import { newId as _newId } from "./lib/db";
import type { Env, JobMessage } from "./types";

// Routes
import * as auth from "./routes/auth";
import * as files from "./routes/files";
import * as shares from "./routes/shares";
import * as providers from "./routes/providers";
import * as keys from "./routes/keys";
import * as admin from "./routes/admin";
import * as publicRoutes from "./routes/public";
import * as notifications from "./routes/notifications";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const router = new Router();

/** Builds the per-request context and applies CORS/security headers. */
async function contextMiddleware(ctx: Ctx, next: Next): Promise<Response> {
  const response = await next();
  const extra: Record<string, string> = {};
  if (ctx.url.pathname.startsWith("/api/")) {
    Object.assign(extra, corsHeaders(ctx.env, ctx.req));
  }
  return withCommonHeaders(response, ctx.requestId, extra);
}

/** Blocks the app during maintenance without locking administrators out. */
async function maintenanceGate(ctx: Ctx, next: Next): Promise<Response> {
  const isPublic = ctx.url.pathname === "/api/health" || ctx.url.pathname === "/api/config";
  if (isPublic) return next();

  const settings = await getSettings(ctx.env);
  if (!booleanSetting(settings, "maintenance_mode")) return next();

  const auth = ctx.state.auth as { user?: { role: string } } | undefined;
  if (auth?.user?.role === "admin") return next();

  throw new ApiError("maintenance_mode", "CloudGather is briefly down for maintenance. Please try again in a few minutes.");
}

router.use(contextMiddleware, withAuth, maintenanceGate);

// --- Accounts ---------------------------------------------------------------
router.post("/api/auth/register", auth.register);
router.post("/api/auth/login", auth.login);
router.post("/api/auth/logout", auth.logout);
router.get("/api/auth/session", auth.session);
router.get("/api/auth/me", requireUser, auth.me);
router.patch("/api/auth/profile", requireUser, auth.updateProfile);
router.get("/api/auth/sessions", requireUser, auth.sessions);
router.delete("/api/auth/sessions/:id", requireUser, auth.revokeSessionRoute);
router.post("/api/auth/password/forgot", auth.forgotPassword);
router.post("/api/auth/password/reset", auth.resetPassword);
router.post("/api/auth/password/change", requireUser, auth.changePassword);
router.post("/api/auth/email/verify", auth.verifyEmail);
router.post("/api/auth/email/resend", requireUser, auth.resendVerification);
router.get("/api/auth/export", requireUser, auth.exportAccount);
router.delete("/api/auth/account", requireUser, auth.deleteAccount);

// --- Files ------------------------------------------------------------------
router.get("/api/files", requireUser, files.list);
router.get("/api/files/tree", requireUser, files.tree);
router.get("/api/files/recent", requireUser, files.recent);
router.get("/api/files/stats", requireUser, files.stats);
router.post("/api/files/folders", requireUser, files.createFolder);
router.post("/api/files/upload", requireUser, files.upload);
router.post("/api/files/bulk", requireUser, files.bulk);
router.post("/api/files/trash/empty", requireUser, files.emptyTrashRoute);
router.get("/api/files/:id", requireUser, files.get);
router.get("/api/files/:id/path", requireUser, files.path);
router.get("/api/files/:id/download", requireUser, files.download);
router.get("/api/files/:id/preview", requireUser, files.preview);
router.patch("/api/files/:id", requireUser, files.update);
router.delete("/api/files/:id", requireUser, files.remove);

// --- Shares -----------------------------------------------------------------
router.post("/api/shares", requireUser, shares.create);
router.get("/api/shares", requireUser, shares.list);
router.get("/api/shares/incoming", requireUser, shares.incoming);
router.patch("/api/shares/:id", requireUser, shares.update);
router.delete("/api/shares/:id", requireUser, shares.revoke);

// --- Connected drives -------------------------------------------------------
router.get("/api/providers", requireUser, providers.list);
router.get("/api/providers/catalog", providers.catalogRoute);
router.get("/api/providers/stats", requireUser, providers.statsRoute);
router.post("/api/providers/reorder", requireUser, providers.reorder);
router.post("/api/providers/:provider/connect", requireUser, providers.connect);
router.get("/api/providers/:provider/callback", providers.callback);
router.post("/api/providers/:provider/credentials", requireUser, providers.credentials);
router.get("/api/providers/:id/browse", requireUser, providers.browse);
router.post("/api/providers/:id/import", requireUser, providers.importFiles);
router.get("/api/providers/:id/file", requireUser, providers.file);
router.patch("/api/providers/:id", requireUser, providers.update);
router.delete("/api/providers/:id", requireUser, providers.disconnect);

// --- Developer keys ---------------------------------------------------------
router.get("/api/keys", requireUser, keys.list);
router.post("/api/keys", requireUser, keys.create);
router.patch("/api/keys/:id", requireUser, keys.update);
router.post("/api/keys/:id/rotate", requireUser, keys.rotate);
router.delete("/api/keys/:id", requireUser, keys.revoke);

// --- Notifications & activity ----------------------------------------------
router.get("/api/notifications", requireUser, notifications.list);
router.post("/api/notifications/read", requireUser, notifications.markRead);
router.delete("/api/notifications/:id", requireUser, notifications.remove);
router.get("/api/activity", requireUser, notifications.activity);

// --- Admin ------------------------------------------------------------------
router.get("/api/admin/stats", requireAdmin, admin.stats);
router.get("/api/admin/users", requireAdmin, admin.users);
router.patch("/api/admin/users/:id", requireAdmin, admin.updateUser);
router.get("/api/admin/settings", requireAdmin, admin.settings);
router.patch("/api/admin/settings", requireAdmin, admin.updateSettingsRoute);
router.get("/api/admin/providers", requireAdmin, admin.providers);
router.patch("/api/admin/providers/:provider", requireAdmin, admin.updateProvider);
router.get("/api/admin/audit", requireAdmin, admin.audit);
router.get("/api/admin/messages", requireAdmin, admin.messages);
router.patch("/api/admin/messages/:id", requireAdmin, admin.updateMessage);
router.get("/api/admin/usage", requireAdmin, admin.usage);
router.get("/api/admin/blog", requireAdmin, admin.blogList);
router.post("/api/admin/blog", requireAdmin, admin.blogCreate);
router.get("/api/admin/blog/:id", requireAdmin, admin.blogGet);
router.patch("/api/admin/blog/:id", requireAdmin, admin.blogUpdate);
router.delete("/api/admin/blog/:id", requireAdmin, admin.blogDelete);
router.post("/api/admin/maintenance", requireAdmin, admin.maintenance);

// --- Developer API ----------------------------------------------------------
router.get("/api/v1/me", keys.withApiKey, keys.me);
router.get("/api/v1/files", keys.withApiKey, keys.files);
router.get("/api/v1/files/:id", keys.withApiKey, keys.fileDetail);
router.get("/api/v1/files/:id/content", keys.withApiKey, keys.fileContent);
router.post("/api/v1/files/folder", keys.withApiKey, keys.createFolder);
router.post("/api/v1/files/upload", keys.withApiKey, keys.uploadFile);
router.patch("/api/v1/files/:id", keys.withApiKey, keys.updateFile);
router.delete("/api/v1/files/:id", keys.withApiKey, keys.deleteFile);
router.get("/api/v1/shares", keys.withApiKey, keys.shares);
router.post("/api/v1/shares", keys.withApiKey, shares.create);
router.delete("/api/v1/shares/:id", keys.withApiKey, shares.revoke);
router.get("/api/v1/stats", keys.withApiKey, keys.stats);
router.get("/api/v1/providers", keys.withApiKey, keys.providers);

// --- Public -----------------------------------------------------------------
router.get("/api/health", publicRoutes.health);
router.get("/api/config", publicRoutes.config);
router.get("/api/public/blog", publicRoutes.blogList);
router.get("/api/public/blog/:slug", publicRoutes.blogPost);
router.post("/api/public/contact", publicRoutes.contact);
router.get("/api/public/sitemap.xml", publicRoutes.sitemap);
router.get("/api/public/shares/:token", publicRoutes.shareMetadata);
router.post("/api/public/shares/:token/unlock", publicRoutes.shareUnlock);
router.get("/api/public/shares/:token/download", publicRoutes.shareDownload);
router.get("/api/public/shares/:token/preview", publicRoutes.sharePreview);

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const API_INFO = {
  name: "CloudGather API",
  version: "1.0.0",
  documentation: "/developers",
  endpoints: {
    health: "/api/health",
    config: "/api/config",
    accounts: "/api/auth/*",
    files: "/api/files/*",
    shares: "/api/shares/*",
    providers: "/api/providers/*",
    keys: "/api/keys/*",
    developer: "/api/v1/*",
    admin: "/api/admin/*",
  },
};

function normalisePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

async function handle(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const pathname = normalisePath(url.pathname);
  const requestId = `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  // Root and favicon-style probes get a friendly payload instead of a 404.
  if (pathname === "/" || pathname === "") {
    return json(API_INFO, { headers: { "x-request-id": requestId } });
  }

  if (request.method === "OPTIONS") {
    const headers = new Headers(corsHeaders(env, request));
    headers.set("x-request-id", requestId);
    return new Response(null, { status: 204, headers });
  }

  const ctx: Ctx = {
    env,
    req: request,
    url,
    params: {},
    requestId,
    waitUntil: (promise) => executionCtx.waitUntil(promise),
    state: {},
  };

  try {
    const match = router.match(request.method, pathname);
    if (!match) throw new RouteNotFound();
    if (match.methodMismatch) throw new MethodMismatch();

    const response = await router.dispatch(match, ctx);
    // Context middleware attaches the request id; direct dispatches may not have run it.
    if (!response.headers.has("x-request-id")) {
      return withCommonHeaders(response, requestId, corsHeaders(env, request));
    }
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return withCommonHeaders(error.toResponse(requestId), requestId, corsHeaders(env, request));
    }
    if (error instanceof RouteNotFound) {
      return withCommonHeaders(
        json({ error: "That endpoint does not exist.", code: "not_found", requestId }, { status: 404 }),
        requestId,
        corsHeaders(env, request),
      );
    }
    if (error instanceof MethodMismatch) {
      return withCommonHeaders(
        json(
          { error: `${request.method} is not allowed on ${pathname}.`, code: "method_not_allowed", requestId },
          { status: 405, headers: { allow: "GET, POST, PATCH, DELETE, OPTIONS" } },
        ),
        requestId,
        corsHeaders(env, request),
      );
    }

    const detail = error instanceof Error ? error.stack ?? error.message : error;
    console.error(`[${requestId}] unhandled error on ${request.method} ${pathname}`, detail);
    return withCommonHeaders(
      json(
        {
          error: "Something went wrong on our side. Please try again.",
          code: "internal_error",
          requestId,
        },
        { status: 500 },
      ),
      requestId,
      corsHeaders(env, request),
    );
  }
}

/** Background jobs. Every handler is idempotent so queue retries are safe. */
async function handleJob(env: Env, message: JobMessage): Promise<void> {
  switch (message.type) {
    case "email.send": {
      const payload = message.message as EmailMessage | undefined;
      if (!payload?.to || !payload.subject) {
        console.warn("[queue] skipping malformed email job");
        return;
      }
      await sendEmail(env, payload);
      return;
    }

    case "provider.import": {
      const { handleImportJob } = await import("./lib/providers-import");
      await handleImportJob(env, message as unknown as import("./lib/providers-import").ImportJob);
      return;
    }

    default:
      console.warn("[queue] unknown job type", (message as { type?: string }).type);
  }
}

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    return handle(request, env, executionCtx);
  },

  async scheduled(controller: ScheduledController, env: Env, executionCtx: ExecutionContext): Promise<void> {
    const settings = await getSettings(env);
    const retention = numericSetting(settings, "trash_retention_days", 30);
    executionCtx.waitUntil(
      runScheduled(env, controller.cron ?? "", retention).catch((error) => {
        console.error("[cron] maintenance failed", error instanceof Error ? error.stack : error);
      }),
    );
  },

  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        await handleJob(env, message.body);
        message.ack();
      } catch (error) {
        console.error("[queue] job failed", message.body?.type, error instanceof Error ? error.message : error);
        // Retry with backoff; after the final attempt the message goes to the DLQ.
        message.retry({ delaySeconds: Math.min(300, 5 * message.attempts ** 2) });
      }
    }
  },
} satisfies ExportedHandler<Env, JobMessage>;

export { _newId };
