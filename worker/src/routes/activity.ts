/** Personal activity feed and data export. */
import { Router } from "../core/router";
import { publicUser, requireUser } from "../core/context";
import { all, count, pageParams, paged } from "../core/db";
import { badRequest, json, readJson } from "../core/http";
import { audit } from "../core/audit";
import { getEntitlements } from "../core/entitlements";
import { now, parseJson } from "../core/util";
import { requireString } from "../core/validate";

export const activityRoutes = new Router();

activityRoutes.get("/api/activity", async (ctx) => {
  const user = requireUser(ctx);
  const params = pageParams(ctx.url, 20, 100);
  const action = ctx.url.searchParams.get("action");
  const where = action ? "user_id = ? AND action = ?" : "user_id = ?";
  const args = action ? [user.id, action] : [user.id];
  const rows = await all(
    ctx.env,
    `SELECT id, action, resource_type, resource_id, details, severity, created_at
       FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...args,
    params.limit,
    params.offset,
  );
  const total = await count(ctx.env, `SELECT count(*) AS value FROM audit_logs WHERE ${where}`, ...args);
  return json({
    activity: rows.map((row) => ({ ...row, details: parseJson((row as { details: string }).details, {}) })),
    ...paged(rows, total, params),
  });
}, { auth: true, scope: "read", summary: "Recent account activity" });

activityRoutes.post("/api/activity", async (ctx) => {
  const payload = await readJson<{ action: string; resourceType?: string; resourceId?: string; details?: Record<string, unknown> }>(ctx.request);
  const action = requireString(payload.action, "Action", { max: 100 });
  if (!/^[a-z0-9_.:-]+$/i.test(action)) throw badRequest("Action may only contain letters, numbers and . _ : -", "invalid_action");
  await audit(ctx, { action, resourceType: payload.resourceType, resourceId: payload.resourceId, details: payload.details });
  return json({ ok: true }, 201);
}, { auth: true, scope: "write", rateLimit: { limit: 120, windowSeconds: 60, by: "user" } });

/** GDPR-style export of everything we hold for the account. */
activityRoutes.get("/api/export", async (ctx) => {
  const user = requireUser(ctx);
  const entitlements = await getEntitlements(ctx.env, user);
  const [files, providers, shares, links, keys, notifications, activity, sessions, invoices] = await Promise.all([
    all(ctx.env, "SELECT id, filename, path, size, mime_type, is_folder, storage_kind, created_at, updated_at, deleted_at FROM files WHERE user_id = ?", user.id),
    all(ctx.env, "SELECT id, provider_name, provider_user_email, status, total_space, used_space, created_at FROM storage_providers WHERE user_id = ?", user.id),
    all(ctx.env, "SELECT id, file_id, shared_with_email, permission_level, expires_at, created_at FROM file_shares WHERE owner_id = ?", user.id),
    all(ctx.env, "SELECT id, file_id, token_prefix, expires_at, download_count, view_count, created_at FROM public_links WHERE owner_id = ?", user.id),
    all(ctx.env, "SELECT id, name, key_prefix, permissions, last_used_at, created_at FROM api_keys WHERE user_id = ?", user.id),
    all(ctx.env, "SELECT id, type, title, body, created_at FROM notifications WHERE user_id = ? LIMIT 500", user.id),
    all(ctx.env, "SELECT action, resource_type, resource_id, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000", user.id),
    all(ctx.env, "SELECT id, ip_address, user_agent, location, created_at, last_seen_at FROM sessions WHERE user_id = ?", user.id),
    all(ctx.env, "SELECT id, number, amount_paid, currency, status, created_at FROM invoices WHERE user_id = ?", user.id),
  ]);

  await audit(ctx, { action: "account.exported", severity: "warning" });
  return json(
    {
      exported_at: now(),
      format_version: 2,
      profile: publicUser(user),
      plan: { id: entitlements.plan.id, name: entitlements.plan.name, limits: entitlements.limits },
      usage: entitlements.usage,
      files,
      providers,
      shares,
      public_links: links,
      api_keys: keys,
      notifications,
      activity,
      sessions,
      invoices,
    },
    200,
    { "content-disposition": `attachment; filename="cloudgather-export-${new Date().toISOString().slice(0, 10)}.json"` },
  );
}, { auth: true, rateLimit: { limit: 5, windowSeconds: 3600, by: "user" }, summary: "Export all account data" });
