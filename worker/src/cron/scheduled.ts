/**
 * Scheduled maintenance. Every job is safe to run repeatedly and never throws
 * out of `runTask` — a failing job records itself and lets the others proceed.
 */
import type { Env } from "../env";
import { all, first, run } from "../core/db";
import { flushOutbox, templates } from "../core/email";
import { retryPending } from "../core/webhooks";
import { notify } from "../core/notify";
import { systemAudit } from "../core/audit";
import { getSettings } from "../core/settings";
import { purgeExpiredEphemera, purgeExpiredTrash, purgeUser } from "../core/purge";
import { loadProviderRow, refreshQuota, type ProviderRow } from "../providers/index";
import { formatBytes, inDays, now } from "../core/util";
import { getPlan } from "../billing/plans";

export const TASKS = [
  "email",
  "webhooks",
  "trash",
  "accounts",
  "ephemera",
  "uploads",
  "providers",
  "quota",
  "digest",
] as const;

export type Task = (typeof TASKS)[number];

type TaskResult = Record<string, unknown>;

/* ------------------------------------------------------------- jobs */

async function markTrashForPurge(env: Env): Promise<number> {
  const settings = await getSettings(env);
  const days = Math.max(1, settings.trash_retention_days || 30);
  const result = await run(
    env,
    "UPDATE files SET purge_at = datetime(deleted_at, ?) WHERE deleted_at IS NOT NULL AND purge_at IS NULL",
    `+${days} days`,
  );
  return result.meta.changes ?? 0;
}

async function purgeDueAccounts(env: Env): Promise<number> {
  const rows = await all<{ id: string }>(
    env,
    "SELECT id FROM users WHERE status = 'pending_deletion' AND purge_at IS NOT NULL AND datetime(purge_at) <= datetime('now') LIMIT 25",
  );
  for (const row of rows) {
    await purgeUser(env, row.id).catch(() => undefined);
  }
  return rows.length;
}

async function abortStaleUploads(env: Env): Promise<number> {
  const rows = await all<{ id: string; r2_key: string; multipart_id: string | null }>(
    env,
    "SELECT id, r2_key, multipart_id FROM upload_sessions WHERE status = 'open' AND datetime(expires_at) <= datetime('now') LIMIT 100",
  );
  for (const row of rows) {
    if (row.multipart_id) {
      try {
        await env.FILES.resumeMultipartUpload(row.r2_key, row.multipart_id).abort();
      } catch {
        /* the upload may already be gone — nothing to clean up */
      }
    }
    await run(env, "UPDATE upload_sessions SET status = 'expired' WHERE id = ?", row.id).catch(() => undefined);
  }
  return rows.length;
}

async function refreshProviderQuotas(env: Env): Promise<{ refreshed: number; errors: number }> {
  const rows = await all<{ id: string; user_id: string }>(
    env,
    `SELECT id, user_id FROM storage_providers
      WHERE status != 'error' AND (last_sync_at IS NULL OR datetime(last_sync_at) < datetime('now','-6 hours'))
      ORDER BY COALESCE(last_sync_at, created_at) ASC LIMIT 25`,
  );
  let refreshed = 0;
  let errors = 0;
  for (const row of rows) {
    const full = (await loadProviderRow(env, row.user_id, row.id)) as ProviderRow | null;
    if (!full) continue;
    try {
      await refreshQuota(env, full);
      refreshed += 1;
    } catch {
      errors += 1;
    }
  }
  return { refreshed, errors };
}

async function storageWarnings(env: Env): Promise<number> {
  const rows = await all<{ id: string; plan: string; storage_quota_bytes: number | null; used: number }>(
    env,
    `SELECT u.id, u.plan, u.storage_quota_bytes,
            (SELECT COALESCE(SUM(size),0) FROM files f
              WHERE f.user_id = u.id AND f.is_folder = 0 AND f.deleted_at IS NULL AND f.storage_kind = 'managed') AS used
       FROM users u WHERE u.status = 'active' LIMIT 2000`,
  );

  let warned = 0;
  for (const row of rows) {
    const quota = row.storage_quota_bytes ?? getPlan(row.plan).limits.storageBytes;
    if (!quota || quota <= 0) continue;
    const percent = Math.round((row.used / quota) * 100);
    if (percent < 90) continue;
    const alreadyWarned = await first<{ id: string }>(
      env,
      "SELECT id FROM notifications WHERE user_id = ? AND type IN ('storage.warning','storage.full') AND datetime(created_at) > datetime('now','-7 days')",
      row.id,
    );
    if (alreadyWarned) continue;
    await notify(env, {
      userId: row.id,
      type: percent >= 100 ? "storage.full" : "storage.warning",
      title: percent >= 100 ? "Your storage is full" : `Storage ${percent}% full`,
      body: `${formatBytes(row.used)} of ${formatBytes(quota)} used.`,
      link: "/billing",
      email: templates.storageWarning(env, percent, formatBytes(row.used), formatBytes(quota)),
    }).catch(() => undefined);
    warned += 1;
  }
  return warned;
}

async function weeklyDigest(env: Env): Promise<number> {
  const rows = await all<{ id: string; email: string; settings: string }>(
    env,
    "SELECT id, email, settings FROM users WHERE status = 'active' AND settings LIKE '%\"emailWeeklyDigest\":true%' LIMIT 500",
  );
  let sent = 0;
  for (const row of rows) {
    const stats = await first<{ uploads: number; shares: number; bytes: number }>(
      env,
      `SELECT
         (SELECT COUNT(*) FROM files WHERE user_id = ? AND is_folder = 0 AND datetime(created_at) > datetime('now','-7 days')) AS uploads,
         (SELECT COUNT(*) FROM file_shares WHERE owner_id = ? AND datetime(created_at) > datetime('now','-7 days')) AS shares,
         (SELECT COALESCE(SUM(size),0) FROM files WHERE user_id = ? AND is_folder = 0 AND deleted_at IS NULL) AS bytes`,
      row.id,
      row.id,
      row.id,
    );
    if (!stats) continue;
    const summary = `${stats.uploads} new file${stats.uploads === 1 ? "" : "s"}, ${stats.shares} new share${stats.shares === 1 ? "" : "s"}, ${formatBytes(stats.bytes)} stored in total.`;
    await notify(env, {
      userId: row.id,
      type: "system.announcement",
      title: "Your weekly CloudGather summary",
      body: summary,
      email: templates.digest(env, summary),
    }).catch(() => undefined);
    sent += 1;
  }
  return sent;
}

async function remindPendingDeletions(env: Env): Promise<number> {
  const rows = await all<{ id: string; purge_at: string }>(
    env,
    `SELECT id, purge_at FROM users WHERE status = 'pending_deletion' AND purge_at IS NOT NULL
       AND datetime(purge_at) BETWEEN datetime('now','+2 days') AND datetime('now','+3 days') LIMIT 100`,
  );
  for (const row of rows) {
    await notify(env, {
      userId: row.id,
      type: "account.deletion",
      title: "Your account is about to be deleted",
      body: `Sign in before ${row.purge_at.slice(0, 10)} to keep your data.`,
      email: templates.accountDeletionScheduled(env, row.purge_at.slice(0, 10)),
      forceEmail: true,
    }).catch(() => undefined);
  }
  return rows.length;
}

async function expireLinksAndShares(env: Env): Promise<number> {
  const links = await run(
    env,
    "UPDATE public_links SET revoked_at = ? WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')",
    now(),
  );
  const shares = await run(
    env,
    "UPDATE file_shares SET revoked_at = ? WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND datetime(expires_at) <= datetime('now')",
    now(),
  );
  return (links.meta.changes ?? 0) + (shares.meta.changes ?? 0);
}

/* --------------------------------------------------------- dispatcher */

export async function runTask(env: Env, task: Task | "all"): Promise<TaskResult> {
  const result: TaskResult = {};
  const should = (name: Task) => task === "all" || task === name;

  if (should("email")) result.email = await flushOutbox(env, 40).catch((error) => ({ error: String(error) }));
  if (should("webhooks")) result.webhooks = await retryPending(env, 40).catch((error) => ({ error: String(error) }));
  if (should("trash")) {
    result.trash_marked = await markTrashForPurge(env).catch(() => 0);
    result.trash_purged = await purgeExpiredTrash(env, 300).catch((error) => ({ error: String(error) }));
    result.links_expired = await expireLinksAndShares(env).catch(() => 0);
  }
  if (should("accounts")) {
    result.accounts_purged = await purgeDueAccounts(env).catch(() => 0);
    result.deletion_reminders = await remindPendingDeletions(env).catch(() => 0);
  }
  if (should("ephemera")) result.ephemera = await purgeExpiredEphemera(env).catch((error) => ({ error: String(error) }));
  if (should("uploads")) result.uploads_aborted = await abortStaleUploads(env).catch(() => 0);
  if (should("providers")) result.providers = await refreshProviderQuotas(env).catch((error) => ({ error: String(error) }));
  if (should("quota")) result.storage_warnings = await storageWarnings(env).catch(() => 0);
  if (should("digest")) result.digests = await weeklyDigest(env).catch(() => 0);

  return result;
}

/**
 * Cron entrypoint. Frequent triggers only drain the queues; heavier jobs run on
 * the daily (03:00 UTC) and weekly (Monday 08:00 UTC) schedules.
 */
export async function scheduled(event: ScheduledController, env: Env): Promise<void> {
  const cron = event.cron;
  const started = Date.now();
  let result: TaskResult = {};

  if (cron === "0 3 * * *") {
    result = await runTask(env, "all");
  } else if (cron === "0 8 * * 1") {
    result = { digest: await weeklyDigest(env).catch(() => 0) };
  } else {
    result.email = await flushOutbox(env, 25).catch((error) => ({ error: String(error) }));
    result.webhooks = await retryPending(env, 25).catch((error) => ({ error: String(error) }));
    result.uploads_aborted = await abortStaleUploads(env).catch(() => 0);
  }

  await systemAudit(env, "cron.completed", { cron, duration_ms: Date.now() - started, ...result }).catch(() => undefined);
}

/** Used by tests and the admin "run now" button. */
export const nextPurgeDate = (days: number) => inDays(days);
