/// <reference types="@cloudflare/workers-types" />
/**
 * CloudGather API — Cloudflare Worker entrypoint.
 *
 * Responsibilities kept here on purpose:
 *   1. build the request context (settings, identity placeholders, tracing id)
 *   2. CORS pre-flight + security headers
 *   3. delegate to the composed router
 *   4. translate thrown HttpErrors into the documented error envelope
 *   5. expose the generated OpenAPI document
 *   6. run the cron schedule
 *
 * Every feature lives in ./routes, ./core, ./providers, ./billing or ./cron.
 */
import type { Env } from "./env";
import { Router, normalizePath } from "./core/router";
import type { Ctx } from "./core/context";
import {
  HttpError,
  clientIp,
  corsHeaders,
  errorResponse,
  json,
  userAgent,
  withSecurityHeaders,
} from "./core/http";
import { getSettings } from "./core/settings";
import { id } from "./core/util";
import { capabilities, appUrl, apiUrl } from "./env";
import { scheduled as runScheduled } from "./cron/scheduled";

import { authRoutes } from "./routes/auth";
import { socialRoutes } from "./routes/social";
import { fileRoutes } from "./routes/files";
import { uploadRoutes } from "./routes/uploads";
import { shareRoutes } from "./routes/shares";
import { providerRoutes } from "./routes/providers";
import { apiKeyRoutes } from "./routes/apikeys";
import { webhookRoutes } from "./routes/webhookRoutes";
import { notificationRoutes } from "./routes/notifications";
import { activityRoutes } from "./routes/activity";
import { billingRoutes } from "./routes/billing";
import { profileRoutes } from "./routes/profile";
import { contactRoutes } from "./routes/contact";
import { blogRoutes } from "./routes/blog";
import { adminRoutes } from "./routes/admin";
import { systemRoutes, API_VERSION } from "./routes/system";

/* ------------------------------------------------------------- router */

const router = new Router()
  .use(systemRoutes)
  .use(authRoutes)
  .use(socialRoutes)
  .use(profileRoutes)
  .use(uploadRoutes)
  .use(shareRoutes)
  .use(providerRoutes)
  .use(fileRoutes)
  .use(apiKeyRoutes)
  .use(webhookRoutes)
  .use(notificationRoutes)
  .use(activityRoutes)
  .use(billingRoutes)
  .use(contactRoutes)
  .use(blogRoutes)
  .use(adminRoutes);

/* ------------------------------------------------------------ openapi */

function openapiDocument(env: Env) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of router.all()) {
    if (route.internal) continue;
    const path = route.path.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
    const parameters = [...route.path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => ({
      name: match[1],
      in: "path",
      required: true,
      schema: { type: "string" },
    }));
    paths[path] = paths[path] || {};
    paths[path][route.method.toLowerCase()] = {
      summary: route.summary || `${route.method} ${route.path}`,
      tags: [path.split("/")[2] || "system"],
      parameters,
      security: route.auth ? [{ bearerAuth: [] }, { apiKeyAuth: [] }] : [],
      responses: {
        200: { description: "Success" },
        ...(route.auth ? { 401: { description: "Authentication required" } } : {}),
        ...(route.admin ? { 403: { description: "Administrator access required" } } : {}),
        ...(route.rateLimit ? { 429: { description: "Rate limited" } } : {}),
      },
    };
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "CloudGather API",
      version: API_VERSION,
      description:
        "Unified cloud storage API. Authenticate with a session bearer token (`Authorization: Bearer <token>`) " +
        "or a personal API key (`X-API-Key: cg_live_…`). All endpoints are also reachable under `/api/v1/…`.",
      contact: { name: "CloudGather support", email: env.SUPPORT_EMAIL || "support@cloudgather.app" },
    },
    servers: [{ url: apiUrl(env).replace(/\/api$/, "") }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
    },
    paths,
  };
}

/* -------------------------------------------------------------- fetch */

async function handleRequest(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const requestId = request.headers.get("x-request-id") || id();
  const cors = corsHeaders(request, env);

  // Pre-flight never touches the database.
  if (request.method === "OPTIONS") {
    return withSecurityHeaders(new Response(null, { status: 204 }), cors, requestId);
  }

  const path = normalizePath(url.pathname);

  if (path === "/" || path === "/api") {
    return withSecurityHeaders(
      json({
        name: "CloudGather API",
        version: API_VERSION,
        status: "ok",
        docs: `${apiUrl(env)}/openapi.json`,
        app: appUrl(env),
        capabilities: capabilities(env),
      }),
      cors,
      requestId,
    );
  }

  if (path === "/api/openapi.json") {
    return withSecurityHeaders(json(openapiDocument(env)), cors, requestId);
  }

  let settings;
  try {
    settings = await getSettings(env);
  } catch (error) {
    console.error(JSON.stringify({ level: "error", requestId, message: "settings_unavailable", error: String(error) }));
    return withSecurityHeaders(
      errorResponse("The service is temporarily unavailable. Please retry shortly.", 503, requestId, "database_unavailable"),
      cors,
      requestId,
    );
  }

  const ctx: Ctx = {
    env,
    request,
    url,
    requestId,
    params: {},
    ip: clientIp(request),
    userAgent: userAgent(request),
    settings,
    waitUntil: (promise) => executionCtx.waitUntil(promise),
    user: null,
    sessionId: null,
    apiKeyId: null,
    scopes: null,
    extraHeaders: {},
  };

  try {
    const response = await router.handle(ctx);
    for (const [key, value] of Object.entries(ctx.extraHeaders)) cors.set(key, value);
    const finished = withSecurityHeaders(response, cors, requestId);
    return request.method === "HEAD" ? new Response(null, { status: finished.status, headers: finished.headers }) : finished;
  } catch (error) {
    for (const [key, value] of Object.entries(ctx.extraHeaders)) cors.set(key, value);

    if (error instanceof HttpError) {
      if (error.status >= 500) {
        console.error(JSON.stringify({ level: "error", requestId, path, status: error.status, message: error.message }));
      }
      return withSecurityHeaders(
        errorResponse(error.message, error.status, requestId, error.code, error.details),
        cors,
        requestId,
      );
    }

    console.error(
      JSON.stringify({
        level: "error",
        requestId,
        path,
        method: request.method,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
      }),
    );
    return withSecurityHeaders(
      errorResponse("Something went wrong on our side. The incident has been logged.", 500, requestId, "internal_error"),
      cors,
      requestId,
    );
  }
}

export default {
  fetch: handleRequest,
  scheduled: async (event: ScheduledController, env: Env, executionCtx: ExecutionContext) => {
    executionCtx.waitUntil(runScheduled(event, env));
  },
} satisfies ExportedHandler<Env>;
