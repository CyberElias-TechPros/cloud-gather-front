/** Outgoing webhook endpoints managed by developers. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, count, first, pageParams, paged, run } from "../core/db";
import { badRequest, json, noContent, notFound, readJson } from "../core/http";
import { encryptString } from "../core/crypto";
import { audit } from "../core/audit";
import { assertWithinCount, getEntitlements, requireCapability } from "../core/entitlements";
import { WEBHOOK_EVENTS, newWebhookSecret, readSecret, sendTestEvent } from "../core/webhooks";
import { id, now, parseJson } from "../core/util";
import { optionalString, optionalUrl, requireArray } from "../core/validate";

export const webhookRoutes = new Router();

const publicEndpoint = (row: Record<string, unknown>) => ({
  id: row.id,
  url: row.url,
  description: row.description,
  events: parseJson<string[]>(row.events as string, ["*"]),
  disabled_at: row.disabled_at,
  failure_count: Number(row.failure_count || 0),
  last_success_at: row.last_success_at,
  created_at: row.created_at,
});

webhookRoutes.get("/api/webhooks", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(ctx.env, "SELECT * FROM webhook_endpoints WHERE user_id = ? ORDER BY created_at DESC", user.id);
  const entitlements = await getEntitlements(ctx.env, user);
  return json({
    endpoints: rows.map(publicEndpoint),
    events: WEBHOOK_EVENTS,
    limits: { max_endpoints: entitlements.limits.maxWebhooks },
    available: entitlements.capabilities.includes("webhooks"),
  });
}, { auth: true, summary: "List webhook endpoints" });

webhookRoutes.post("/api/webhooks", async (ctx) => {
  const user = requireUser(ctx);
  const entitlements = await getEntitlements(ctx.env, user);
  requireCapability(entitlements, "webhooks", "Webhooks");
  assertWithinCount(entitlements.usage.webhookCount, entitlements.limits.maxWebhooks, "webhook endpoint", entitlements.plan.name);

  const payload = await readJson<{ url: string; description?: string; events?: string[] }>(ctx.request);
  const url = optionalUrl(payload.url, "Endpoint URL", { requireHttps: true });
  if (!url) throw badRequest("An https endpoint URL is required.", "invalid_url");

  const events = payload.events ? requireArray<string>(payload.events, "events", 30) : ["*"];
  const invalid = events.filter((event) => event !== "*" && !(WEBHOOK_EVENTS as readonly string[]).includes(event));
  if (invalid.length) throw badRequest(`Unknown events: ${invalid.join(", ")}.`, "invalid_event");

  const secret = newWebhookSecret();
  const endpointId = id();
  await run(
    ctx.env,
    "INSERT INTO webhook_endpoints(id, user_id, url, description, secret, events) VALUES(?, ?, ?, ?, ?, ?)",
    endpointId,
    user.id,
    url,
    optionalString(payload.description, "Description", 200),
    ctx.env.ENCRYPTION_KEY ? await encryptString(ctx.env, secret) : secret,
    JSON.stringify(events),
  );
  await audit(ctx, { action: "webhook.created", resourceType: "webhook", resourceId: endpointId, details: { url } });
  const row = await first(ctx.env, "SELECT * FROM webhook_endpoints WHERE id = ?", endpointId);
  return json({ endpoint: { ...publicEndpoint(row as Record<string, unknown>), secret }, warning: "Store this signing secret now — it is not shown again." }, 201);
}, { auth: true, verified: true, summary: "Create a webhook endpoint" });

webhookRoutes.patch("/api/webhooks/:id", async (ctx) => {
  const user = requireUser(ctx);
  const row = await first<{ id: string }>(ctx.env, "SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!row) throw notFound("Webhook endpoint not found.", "webhook_not_found");
  const payload = await readJson<{ url?: string; description?: string | null; events?: string[]; enabled?: boolean }>(ctx.request);
  const updates: string[] = [];
  const args: unknown[] = [];
  if (payload.url !== undefined) {
    const url = optionalUrl(payload.url, "Endpoint URL", { requireHttps: true });
    if (!url) throw badRequest("An https endpoint URL is required.", "invalid_url");
    updates.push("url = ?");
    args.push(url);
  }
  if (payload.description !== undefined) {
    updates.push("description = ?");
    args.push(optionalString(payload.description, "Description", 200));
  }
  if (payload.events !== undefined) {
    const events = requireArray<string>(payload.events, "events", 30);
    updates.push("events = ?");
    args.push(JSON.stringify(events));
  }
  if (payload.enabled !== undefined) {
    updates.push("disabled_at = ?", "failure_count = 0");
    args.push(payload.enabled ? null : now());
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");
  await run(ctx.env, `UPDATE webhook_endpoints SET ${updates.join(", ")} WHERE id = ?`, ...args, row.id);
  await audit(ctx, { action: "webhook.updated", resourceType: "webhook", resourceId: row.id });
  return json({ endpoint: publicEndpoint((await first(ctx.env, "SELECT * FROM webhook_endpoints WHERE id = ?", row.id)) as Record<string, unknown>) });
}, { auth: true });

webhookRoutes.delete("/api/webhooks/:id", async (ctx) => {
  const user = requireUser(ctx);
  const result = await run(ctx.env, "DELETE FROM webhook_endpoints WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!result.meta.changes) throw notFound("Webhook endpoint not found.", "webhook_not_found");
  await audit(ctx, { action: "webhook.deleted", resourceType: "webhook", resourceId: ctx.params.id });
  return noContent();
}, { auth: true });

webhookRoutes.post("/api/webhooks/:id/test", async (ctx) => {
  const user = requireUser(ctx);
  const result = await sendTestEvent(ctx.env, ctx.params.id, user.id);
  return json({ ok: result.ok, status: result.status, response: result.body });
}, { auth: true, rateLimit: { limit: 10, windowSeconds: 300, by: "user" }, summary: "Send a ping event" });

webhookRoutes.get("/api/webhooks/:id/deliveries", async (ctx) => {
  const user = requireUser(ctx);
  const endpoint = await first<{ id: string }>(ctx.env, "SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!endpoint) throw notFound("Webhook endpoint not found.", "webhook_not_found");
  const params = pageParams(ctx.url, 25, 100);
  const rows = await all(
    ctx.env,
    `SELECT id, event_id, event_type, status, attempts, response_status, response_body, delivered_at, created_at
       FROM webhook_deliveries WHERE endpoint_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    endpoint.id,
    params.limit,
    params.offset,
  );
  const total = await count(ctx.env, "SELECT count(*) AS value FROM webhook_deliveries WHERE endpoint_id = ?", endpoint.id);
  return json({ deliveries: rows, ...paged(rows, total, params) });
}, { auth: true });

webhookRoutes.get("/api/webhooks/:id/secret", async (ctx) => {
  const user = requireUser(ctx);
  const row = await first<{ secret: string }>(ctx.env, "SELECT secret FROM webhook_endpoints WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!row) throw notFound("Webhook endpoint not found.", "webhook_not_found");
  await audit(ctx, { action: "webhook.secret_viewed", resourceType: "webhook", resourceId: ctx.params.id, severity: "warning" });
  return json({ secret: await readSecret(ctx.env, row.secret) });
}, { auth: true, rateLimit: { limit: 5, windowSeconds: 300, by: "user" } });
