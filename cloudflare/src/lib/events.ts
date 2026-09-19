/**
 * Activity: audit log, per-day usage counters and in-app notifications.
 *
 * Writes go through a single `batch()` so a logged action and its counter can
 * never disagree, and sends are best-effort — failing to record analytics must
 * never fail the user's request.
 */

import { all, batch, dayKey, newId, nowIso, parseJson, stringifyJson } from "./db";
import type { Ctx } from "./http";
import type { Env, UserRow } from "../types";

export type UsageField = "uploads" | "downloads" | "deletes" | "shares_created" | "api_calls" | "bytes_uploaded" | "bytes_downloaded";

export interface AuditInput {
  action: string;
  user?: UserRow | null;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ctx?: Ctx;
}

export interface UsageDelta {
  uploads?: number;
  downloads?: number;
  deletes?: number;
  shares_created?: number;
  api_calls?: number;
  bytes_uploaded?: number;
  bytes_downloaded?: number;
}

function usageStatement(env: Env, userId: string, delta: UsageDelta): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO usage_daily (day, user_id, uploads, downloads, deletes, shares_created, api_calls, bytes_uploaded, bytes_downloaded)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (day, user_id) DO UPDATE SET
       uploads = usage_daily.uploads + excluded.uploads,
       downloads = usage_daily.downloads + excluded.downloads,
       deletes = usage_daily.deletes + excluded.deletes,
       shares_created = usage_daily.shares_created + excluded.shares_created,
       api_calls = usage_daily.api_calls + excluded.api_calls,
       bytes_uploaded = usage_daily.bytes_uploaded + excluded.bytes_uploaded,
       bytes_downloaded = usage_daily.bytes_downloaded + excluded.bytes_downloaded`,
  ).bind(
    dayKey(),
    userId,
    delta.uploads ?? 0,
    delta.downloads ?? 0,
    delta.deletes ?? 0,
    delta.shares_created ?? 0,
    delta.api_calls ?? 0,
    delta.bytes_uploaded ?? 0,
    delta.bytes_downloaded ?? 0,
  );
}

function auditStatement(env: Env, input: AuditInput): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO audit_logs (id, user_id, actor_email, action, resource_type, resource_id, details, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    newId("aud"),
    input.user?.id ?? null,
    input.user?.email ?? null,
    input.action,
    input.resourceType ?? null,
    input.resourceId ?? null,
    stringifyJson(input.details ?? {}),
    input.ctx ? (input.ctx.req.headers.get("cf-connecting-ip") ?? null) : null,
    input.ctx ? (input.ctx.req.headers.get("user-agent") ?? null) : null,
    nowIso(),
  );
}

/** Records an audit entry and, optionally, usage counters in one round trip. */
export async function record(
  env: Env,
  input: AuditInput & { usage?: UsageDelta; userId?: string },
): Promise<void> {
  const statements: D1PreparedStatement[] = [auditStatement(env, input)];
  const userId = input.user?.id ?? input.userId;
  if (input.usage && userId) statements.push(usageStatement(env, userId, input.usage));
  try {
    await batch(env.DB, statements);
  } catch (error) {
    console.warn("[events] could not record activity", error instanceof Error ? error.message : error);
  }
}

export async function recordUsage(env: Env, userId: string, delta: UsageDelta): Promise<void> {
  try {
    await usageStatement(env, userId, delta).run();
  } catch (error) {
    console.warn("[events] could not record usage", error instanceof Error ? error.message : error);
  }
}

export async function notify(
  env: Env,
  userId: string,
  notification: { type: string; title: string; body?: string | null; link?: string | null },
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(newId("ntf"), userId, notification.type, notification.title, notification.body ?? null, notification.link ?? null, nowIso())
      .run();
  } catch (error) {
    console.warn("[events] could not create notification", error instanceof Error ? error.message : error);
  }
}

export async function listActivity(
  env: Env,
  userId: string,
  options: { limit?: number; offset?: number; action?: string } = {},
): Promise<Array<{ id: string; action: string; resourceType: string | null; resourceId: string | null; details: Record<string, unknown>; createdAt: string }>> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const rows = await all<{ id: string; action: string; resource_type: string | null; resource_id: string | null; details: string; created_at: string }>(
    env.DB,
    `SELECT id, action, resource_type, resource_id, details, created_at
       FROM audit_logs
      WHERE user_id = ? ${options.action ? "AND action = ?" : ""}
      ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...(options.action ? [userId, options.action, limit, options.offset ?? 0] : [userId, limit, options.offset ?? 0]),
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: parseJson<Record<string, unknown>>(row.details, {}),
    createdAt: row.created_at,
  }));
}

export const ACTIVITY_LABELS: Record<string, string> = {
  "auth.registered": "created an account",
  "auth.login": "signed in",
  "auth.logout": "signed out",
  "auth.password_changed": "changed their password",
  "auth.password_reset": "reset their password",
  "file.uploaded": "uploaded a file",
  "file.folder_created": "created a folder",
  "file.renamed": "renamed an item",
  "file.moved": "moved an item",
  "file.trashed": "moved an item to trash",
  "file.restored": "restored an item",
  "file.deleted": "permanently deleted an item",
  "file.downloaded": "downloaded a file",
  "file.starred": "starred an item",
  "share.created": "created a share link",
  "share.revoked": "revoked a share link",
  "provider.connected": "connected a drive",
  "provider.disconnected": "disconnected a drive",
  "provider.imported": "imported files from a drive",
  "api_key.created": "created an API key",
  "api_key.revoked": "revoked an API key",
  "admin.settings_updated": "updated platform settings",
  "admin.user_updated": "updated a user",
};
