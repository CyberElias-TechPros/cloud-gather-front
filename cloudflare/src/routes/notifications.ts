/** In-app notifications: list, mark read, delete. */

import { currentUser } from "../lib/auth";
import { all, first, nowIso, run } from "../lib/db";
import { json, notFound, type Ctx } from "../lib/http";
import { optionalArray, queryBool, queryInt } from "../lib/validate";
import type { NotificationRow } from "../types";

export async function list(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const unreadOnly = queryBool(ctx.url, "unread");
  const limit = queryInt(ctx.url, "limit", { fallback: 50, min: 1, max: 200 });

  const rows = await all<NotificationRow>(
    ctx.env.DB,
    `SELECT * FROM notifications WHERE user_id = ? ${unreadOnly ? "AND read_at IS NULL" : ""} ORDER BY created_at DESC LIMIT ?`,
    user.id,
    limit,
  );

  const unread = await first<{ count: number }>(
    ctx.env.DB,
    `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL`,
    user.id,
  );

  return json({
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      body: row.body,
      link: row.link,
      readAt: row.read_at,
      createdAt: row.created_at,
    })),
    unreadCount: unread?.count ?? 0,
  });
}

export async function markRead(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const ids = optionalArray(input, "ids", 200)?.map(String);

  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    await run(
      ctx.env.DB,
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders})`,
      nowIso(),
      user.id,
      ...ids,
    );
  } else {
    await run(ctx.env.DB, `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, nowIso(), user.id);
  }

  return json({ ok: true });
}

export async function remove(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const result = await run(ctx.env.DB, `DELETE FROM notifications WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if ((result.meta.changes ?? 0) === 0) throw notFound("That notification no longer exists.");
  return json({ ok: true });
}

export async function activity(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const limit = queryInt(ctx.url, "limit", { fallback: 25, min: 1, max: 200 });
  const action = ctx.url.searchParams.get("action") ?? undefined;
  const { listActivity } = await import("../lib/events");
  const events = await listActivity(ctx.env, user.id, { limit, action });
  return json({ events });
}
