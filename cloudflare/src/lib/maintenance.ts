/**
 * Scheduled housekeeping. Two cron triggers share this module:
 *
 *   `*\/30 * * * *`  light sweep — expired sessions, tokens, rate limits and
 *                   share links. Cheap enough to run often.
 *   `0 3 * * *`     nightly — trash purge, token refresh for connected drives,
 *                   storage warnings and retention trimming.
 *
 * Everything here is idempotent and safe to run concurrently; a distributed lock
 * keeps the heavy pass single-flight when several isolates wake at once.
 */

import { acquireLock, all, first, nowIso, run } from "./db";
import { queueEmail, templates } from "./email";
import { purgeExpiredTrash } from "./files";
import { expireOldShares } from "../routes/shares";
import { pruneRateLimits } from "./ratelimit";
import type { Env } from "../types";

export interface MaintenanceSummary {
  sessions: number;
  tokens: number;
  rateLimits: number;
  sharesExpired: number;
  notifications: number;
  auditTrimmed: number;
  trash: number;
  storageWarnings: number;
  usageTrimmed: number;
  durationMs: number;
}

export interface MaintenanceOptions {
  /** Heavy tasks only belong on the nightly run (or an explicit admin trigger). */
  includeHeavy?: boolean;
}

const AUDIT_RETENTION_DAYS = 180;
const NOTIFICATION_RETENTION_DAYS = 90;
const USAGE_RETENTION_DAYS = 730;
const SESSION_GRACE_DAYS = 7;

export async function runMaintenance(env: Env, retentionDays: number, options: MaintenanceOptions = {}): Promise<MaintenanceSummary> {
  const started = Date.now();
  const now = nowIso();
  const summary: MaintenanceSummary = {
    sessions: 0,
    tokens: 0,
    rateLimits: 0,
    sharesExpired: 0,
    notifications: 0,
    auditTrimmed: 0,
    trash: 0,
    storageWarnings: 0,
    usageTrimmed: 0,
    durationMs: 0,
  };

  const sessions = await run(
    env.DB,
    `DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)`,
    now,
    new Date(Date.now() - SESSION_GRACE_DAYS * 86_400_000).toISOString(),
  );
  summary.sessions = sessions.meta.changes ?? 0;

  const tokens = await run(
    env.DB,
    `DELETE FROM tokens WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)`,
    now,
    new Date(Date.now() - 86_400_000).toISOString(),
  );
  summary.tokens = tokens.meta.changes ?? 0;

  summary.rateLimits = await pruneRateLimits(env);
  summary.sharesExpired = await expireOldShares(env);

  const notifications = await run(
    env.DB,
    `DELETE FROM notifications WHERE created_at < ? OR (read_at IS NOT NULL AND read_at < ?)`,
    new Date(Date.now() - NOTIFICATION_RETENTION_DAYS * 86_400_000).toISOString(),
    new Date(Date.now() - 30 * 86_400_000).toISOString(),
  );
  summary.notifications = notifications.meta.changes ?? 0;

  if (!options.includeHeavy) {
    summary.durationMs = Date.now() - started;
    return summary;
  }

  const locked = await acquireLock(env, "maintenance:heavy", 3600);
  if (!locked) {
    console.log("[maintenance] heavy pass already running elsewhere; skipping");
    summary.durationMs = Date.now() - started;
    return summary;
  }

  const trash = await purgeExpiredTrash(env, retentionDays);
  summary.trash = trash.rows;

  const audit = await run(
    env.DB,
    `DELETE FROM audit_logs WHERE created_at < ?`,
    new Date(Date.now() - AUDIT_RETENTION_DAYS * 86_400_000).toISOString(),
  );
  summary.auditTrimmed = audit.meta.changes ?? 0;

  const usage = await run(
    env.DB,
    `DELETE FROM usage_daily WHERE day < ?`,
    new Date(Date.now() - USAGE_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10),
  );
  summary.usageTrimmed = usage.meta.changes ?? 0;

  summary.storageWarnings = await sendStorageWarnings(env);

  summary.durationMs = Date.now() - started;
  console.log(`[maintenance] ${JSON.stringify(summary)}`);
  return summary;
}

/** Entry point for `scheduled()`: picks the right pass for the cron expression. */
export async function runScheduled(env: Env, cron: string, retentionDays: number): Promise<MaintenanceSummary> {
  const heavy = cron.trim().startsWith("0 3") || cron.includes("0 3 * * *");
  return runMaintenance(env, retentionDays, { includeHeavy: heavy });
}

/**
 * Warns accounts that are running out of room. One e-mail per user per week,
 * tracked in KV so the nightly job stays quiet.
 */
export async function sendStorageWarnings(env: Env, threshold = 0.85): Promise<number> {
  const users = await all<{ id: string; email: string; display_name: string | null; storage_quota_bytes: number; used: number }>(
    env.DB,
    `SELECT u.id, u.email, u.display_name, u.storage_quota_bytes,
            COALESCE(SUM(f.size), 0) AS used
       FROM users u
       LEFT JOIN files f ON f.user_id = u.id AND f.trashed_at IS NULL AND f.is_folder = 0
      WHERE u.status = 'active'
      GROUP BY u.id
     HAVING u.storage_quota_bytes > 0 AND used > u.storage_quota_bytes * ?`,
    threshold,
  );

  let sent = 0;
  for (const user of users) {
    const key = `warn:storage:${user.id}`;
    const already = await env.CACHE.get(key).catch(() => null);
    if (already) continue;

    const percent = Math.round((user.used / user.storage_quota_bytes) * 100);
    const template = templates.storageWarning(
      env.APP_NAME ?? "CloudGather",
      env.APP_URL ?? "",
      percent,
      `${Math.round(user.used / 1_073_741_824)} GB`,
      `${Math.round(user.storage_quota_bytes / 1_073_741_824)} GB`,
    );
    await queueEmail(env, { to: user.email, subject: template.subject, html: template.html });

    await run(
      env.DB,
      `INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?, ?, 'storage_warning', ?, ?, '/storage', ?)`,
      `ntf_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
      user.id,
      `Storage is ${percent}% full`,
      "Free up space or ask an administrator for a larger allowance.",
      nowIso(),
    );

    await env.CACHE.put(key, "sent", { expirationTtl: 7 * 86_400 }).catch(() => undefined);
    sent += 1;
  }

  return sent;
}

/** Small runtime snapshot used by the health endpoint and the admin console. */
export async function platformSnapshot(env: Env) {
  const [users, files, bytes, shares] = await Promise.all([
    first<{ count: number }>(env.DB, `SELECT COUNT(*) AS count FROM users`),
    first<{ count: number }>(env.DB, `SELECT COUNT(*) AS count FROM files WHERE trashed_at IS NULL`),
    first<{ total: number | null }>(env.DB, `SELECT SUM(size) AS total FROM files WHERE trashed_at IS NULL AND is_folder = 0`),
    first<{ count: number }>(env.DB, `SELECT COUNT(*) AS count FROM shares WHERE revoked_at IS NULL`),
  ]);
  return {
    users: users?.count ?? 0,
    files: files?.count ?? 0,
    bytes: bytes?.total ?? 0,
    activeShares: shares?.count ?? 0,
    environment: env.ENVIRONMENT ?? "development",
  };
}
