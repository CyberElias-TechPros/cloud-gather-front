/** In-app notification centre and delivery preferences. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, count, first, pageParams, paged, run } from "../core/db";
import { json, noContent, notFound, readJson } from "../core/http";
import { DEFAULT_NOTIFICATION_PREFERENCES, markAllRead, readNotificationPreferences, unreadCount } from "../core/notify";
import { now, parseJson } from "../core/util";

export const notificationRoutes = new Router();

notificationRoutes.get("/api/notifications", async (ctx) => {
  const user = requireUser(ctx);
  const params = pageParams(ctx.url, 25, 100);
  const unreadOnly = ctx.url.searchParams.get("unread") === "1";
  const where = unreadOnly ? "user_id = ? AND read_at IS NULL" : "user_id = ?";
  const rows = await all(
    ctx.env,
    `SELECT id, type, title, body, link, data, read_at, created_at FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    user.id,
    params.limit,
    params.offset,
  );
  const total = await count(ctx.env, `SELECT count(*) AS value FROM notifications WHERE ${where}`, user.id);
  return json({
    notifications: rows.map((row) => ({ ...row, data: parseJson((row as { data: string }).data, {}) })),
    unread: await unreadCount(ctx.env, user.id),
    ...paged(rows, total, params),
  });
}, { auth: true, scope: "read", summary: "List notifications" });

notificationRoutes.get("/api/notifications/unread-count", async (ctx) => {
  const user = requireUser(ctx);
  return json({ unread: await unreadCount(ctx.env, user.id) });
}, { auth: true, scope: "read" });

notificationRoutes.post("/api/notifications/:id/read", async (ctx) => {
  const user = requireUser(ctx);
  const result = await run(ctx.env, "UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL", now(), ctx.params.id, user.id);
  if (!result.meta.changes) {
    const exists = await first(ctx.env, "SELECT id FROM notifications WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
    if (!exists) throw notFound("Notification not found.", "notification_not_found");
  }
  return json({ ok: true, unread: await unreadCount(ctx.env, user.id) });
}, { auth: true, scope: "write" });

notificationRoutes.post("/api/notifications/read-all", async (ctx) => {
  const user = requireUser(ctx);
  const updated = await markAllRead(ctx.env, user.id);
  return json({ ok: true, updated, unread: 0 });
}, { auth: true, scope: "write" });

notificationRoutes.delete("/api/notifications/:id", async (ctx) => {
  const user = requireUser(ctx);
  const result = await run(ctx.env, "DELETE FROM notifications WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!result.meta.changes) throw notFound("Notification not found.", "notification_not_found");
  return noContent();
}, { auth: true, scope: "write" });

notificationRoutes.delete("/api/notifications", async (ctx) => {
  const user = requireUser(ctx);
  await run(ctx.env, "DELETE FROM notifications WHERE user_id = ? AND read_at IS NOT NULL", user.id);
  return noContent();
}, { auth: true, scope: "write" });

notificationRoutes.get("/api/notifications/preferences", async (ctx) => {
  const user = requireUser(ctx);
  return json({ preferences: readNotificationPreferences(user.settings), defaults: DEFAULT_NOTIFICATION_PREFERENCES });
}, { auth: true, scope: "read" });

notificationRoutes.patch("/api/notifications/preferences", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<Record<string, boolean>>(ctx.request);
  const current = readNotificationPreferences(user.settings);
  const next = { ...current };
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES) as (keyof typeof DEFAULT_NOTIFICATION_PREFERENCES)[]) {
    if (typeof payload[key] === "boolean") next[key] = payload[key];
  }
  const settings = { ...user.settings, notifications: next };
  await run(ctx.env, "UPDATE users SET settings = ?, updated_at = ? WHERE id = ?", JSON.stringify(settings), now(), user.id);
  return json({ preferences: next });
}, { auth: true, scope: "write" });
