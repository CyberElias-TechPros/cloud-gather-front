/**
 * Scheduled maintenance (Cron Triggers) and retention rules.
 *
 * Runs are idempotent and safe to repeat — Cloudflare may invoke a cron slightly
 * early or late, and a retry must never double-delete or double-notify.
 */

import type { Env } from "../types";
import { cleanupRateLimits } from "./ratelimit";
import { loadSettings } from "./settings";
import { notify, recordAudit, sendEmail } from "./events";
import { refreshExpiredTokens } from "../routes/providers";
import { escapeHtml, storageWarningEmail } from "./emailTemplates";

export interface MaintenanceReport {
  cron: string;
  ranAt: string;
  tasks: Record<string, number | string>;
}

export async function runScheduled(env: Env, cron: string): Promise<MaintenanceReport> {
  const tasks: Record<string, number | string> = {};
  const now = new Date();
  const settings = await loadSettings(env);

  // Both schedules share the cheap housekeeping.
  tasks.rateLimitsPruned = await pruneRateLimits(env);
  tasks.sessionsExpired = await expireSessions(env);
  tasks.tokensExpired = await expireAuthTokens(env);
  tasks.jobReceiptsPruned = await pruneJobReceipts(env);
  tasks.adminBootstrapped = await ensureAdminBootstrap(env);

  if (cron.startsWith("15 3")) {
    tasks.trashPurged = await purgeExpiredTrash(env, settings.trash_retention_days);
    tasks.tokensRefreshed = await refreshExpiredTokens(env);
    tasks.storageWarnings = await sendStorageWarnings(env, settings);
    tasks.sharesExpired = await markExpiredShares(env);
  }

  console.log(JSON.stringify({ level: "info", message: "scheduled run complete", cron, tasks, at: now.toISOString() }));
  return { cron, ranAt: now.toISOString(), tasks };
}

async function pruneRateLimits(env: Env): Promise<number> {
  await cleanupRateLimits(env);
  return 1;
}

async function expireSessions(env: Env): Promise<number> {
  const result = await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?1 OR (revoked_at IS NOT NULL AND revoked_at < ?2)")
    .bind(new Date().toISOString(), new Date(Date.now() - 7 * 86_400_000).toISOString())
    .run();
  return result.meta.changes ?? 0;
}

async function expireAuthTokens(env: Env): Promise<number> {
  const result = await env.DB.prepare("DELETE FROM auth_tokens WHERE expires_at < ?1 OR used_at IS NOT NULL")
    .bind(new Date(Date.now() - 86_400_000).toISOString())
    .run();
  return result.meta.changes ?? 0;
}

async function pruneJobReceipts(env: Env): Promise<number> {
  const result = await env.DB.prepare("DELETE FROM job_receipts WHERE created_at < ?1")
    .bind(new Date(Date.now() - 3 * 86_400_000).toISOString())
    .run();
  return result.meta.changes ?? 0;
}

/** The operator's ADMIN_EMAIL becomes an admin as soon as that account exists. */
async function ensureAdminBootstrap(env: Env): Promise<number | string> {
  if (!env.ADMIN_EMAIL) return "skipped";
  const email = env.ADMIN_EMAIL.trim().toLowerCase();
  const result = await env.DB.prepare("UPDATE users SET role = 'admin', updated_at = ?1 WHERE email_normalized = ?2 AND role != 'admin'")
    .bind(new Date().toISOString(), email)
    .run();
  const changed = result.meta.changes ?? 0;
  if (changed > 0) {
    await recordAudit(env, { userId: null, actorEmail: email, action: "admin.bootstrap_promoted", details: { email } });
  }
  return changed;
}

/** Trash older than the retention window is removed — objects first, then rows. */
async function purgeExpiredTrash(env: Env, retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const expired = await env.DB.prepare("SELECT id, user_id FROM files WHERE trashed_at IS NOT NULL AND trashed_at < ?1")
    .bind(cutoff)
    .all<{ id: string; user_id: string }>();

  const roots = expired.results ?? [];
  const targetIds = new Set<string>();
  for (const row of roots) targetIds.add(row.id);

  // Include descendants of expired folders.
  for (const row of roots) {
    const folder = await env.DB.prepare("SELECT id, path, is_folder FROM files WHERE id = ?1").bind(row.id).first<{ id: string; path: string; is_folder: number }>();
    if (folder?.is_folder) {
      const children = await env.DB.prepare("SELECT id FROM files WHERE user_id = ?1 AND path LIKE ?2")
        .bind(row.user_id, `${folder.path.replace(/[\\%_]/g, (m) => `\\${m}`)}/%`)
        .all<{ id: string }>();
      for (const child of children.results ?? []) targetIds.add(child.id);
    }
  }

  const ids = [...targetIds];
  if (ids.length === 0) return 0;

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const placeholders = batch.map((_, index) => `?${index + 1}`).join(", ");
    const objects = await env.DB.prepare(
      `SELECT storage_key FROM files WHERE id IN (${placeholders}) AND storage_key IS NOT NULL`,
    )
      .bind(...batch)
      .all<{ storage_key: string }>();
    const keys = (objects.results ?? []).map((row) => row.storage_key);
    if (keys.length > 0) await env.FILES.delete(keys);
    await env.DB.prepare(`DELETE FROM files WHERE id IN (${placeholders})`).bind(...batch).run();
  }

  return ids.length;
}

async function markExpiredShares(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    "UPDATE shares SET revoked_at = ?1 WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at < ?1",
  )
    .bind(new Date().toISOString())
    .run();
  return result.meta.changes ?? 0;
}

/** Warn (once per week per user) when the pool is over 85% full. */
async function sendStorageWarnings(env: Env, settings: { default_quota_gb: number; app_name: string; support_email: string }): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT u.id, u.email, u.display_name, COALESCE(u.storage_quota_bytes, ?1) AS quota,
            COALESCE((SELECT SUM(f.size) FROM files f WHERE f.user_id = u.id AND f.is_folder = 0 AND f.trashed_at IS NULL AND f.storage_key IS NOT NULL), 0) AS used
       FROM users u WHERE u.status = 'active'`,
  )
    .bind(settings.default_quota_gb * 1024 * 1024 * 1024)
    .all<{ id: string; email: string; display_name: string | null; quota: number; used: number }>();

  const appUrl = env.APP_URL;
  let warned = 0;

  for (const row of rows.results ?? []) {
    if (row.quota <= 0) continue;
    const percent = (row.used / row.quota) * 100;
    if (percent < 85) continue;

    const dedupeKey = `warn:storage:${row.id}`;
    if (await env.CACHE.get(dedupeKey)) continue;
    await env.CACHE.put(dedupeKey, "1", { expirationTtl: 7 * 86_400 });

    await notify(env, row.id, "storage", `Storage at ${Math.round(percent)}%`, `You have used ${formatGb(row.used)} GB of ${formatGb(row.quota)} GB.`, "/storage");
    if (settings.app_name && env.RESEND_API_KEY) {
      const template = storageWarningEmail(
        { appName: settings.app_name, appUrl, supportEmail: settings.support_email },
        Math.round(percent),
        formatGb(row.used),
        formatGb(row.quota),
      );
      await sendEmail(env, row.email, template.subject, template.html, template.text);
    }
    warned += 1;
  }
  return warned;
}

function formatGb(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(1);
}

/** Ops helper: plain-text summary of platform state for the admin dashboard. */
export async function platformSnapshot(env: Env) {
  const [users, files, objects] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM users").first<{ total: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(size),0) AS bytes FROM files WHERE is_folder = 0").first<{ total: number; bytes: number }>(),
    env.FILES.list({ limit: 1 }),
  ]);
  return {
    users: users?.total ?? 0,
    files: files?.total ?? 0,
    bytes: files?.bytes ?? 0,
    storageTruncated: objects.truncated,
    adminEmailConfigured: Boolean(env.ADMIN_EMAIL),
    emailConfigured: Boolean(env.RESEND_API_KEY),
    generatedAt: new Date().toISOString(),
  };
}

export { escapeHtml };
