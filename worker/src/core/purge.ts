/**
 * Destructive clean-up helpers shared by the admin console and the cron jobs.
 * Everything here is idempotent: re-running a purge on already-purged data is a
 * no-op rather than an error.
 */
import type { Env } from "../env";
import { all, run } from "./db";
import { systemAudit } from "./audit";

/** Deletes every R2 object under a prefix, paging through the listing. */
export async function deletePrefix(env: Env, prefix: string): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;
  for (let page = 0; page < 200; page += 1) {
    const listing = await env.FILES.list({ prefix, cursor, limit: 500 });
    const keys = listing.objects.map((object) => object.key);
    if (keys.length) {
      await env.FILES.delete(keys);
      deleted += keys.length;
    }
    if (!listing.truncated) break;
    cursor = listing.cursor;
  }
  return deleted;
}

/** Hard-deletes trashed rows whose retention window has elapsed. */
export async function purgeExpiredTrash(env: Env, limit = 500): Promise<{ files: number; bytes: number }> {
  const rows = await all<{ id: string; r2_key: string | null; size: number; storage_kind: string }>(
    env,
    `SELECT id, r2_key, size, storage_kind FROM files
      WHERE deleted_at IS NOT NULL AND purge_at IS NOT NULL AND datetime(purge_at) <= datetime('now')
      LIMIT ?`,
    limit,
  );
  if (!rows.length) return { files: 0, bytes: 0 };

  const keys = rows.filter((row) => row.storage_kind === "managed" && row.r2_key).map((row) => row.r2_key as string);
  for (let index = 0; index < keys.length; index += 100) {
    await env.FILES.delete(keys.slice(index, index + 100)).catch(() => undefined);
  }

  let bytes = 0;
  for (const row of rows) {
    bytes += row.size || 0;
    await run(env, "DELETE FROM files WHERE id = ?", row.id).catch(() => undefined);
  }
  return { files: rows.length, bytes };
}

/** Removes every trace of a user: objects, rows, sessions, tokens. */
export async function purgeUser(env: Env, userId: string): Promise<void> {
  await deletePrefix(env, `${userId}/`).catch(() => undefined);
  await env.FILES.delete(`avatars/${userId}`).catch(() => undefined);

  const statements = [
    "DELETE FROM file_versions WHERE file_id IN (SELECT id FROM files WHERE user_id = ?)",
    "DELETE FROM public_link_visits WHERE link_id IN (SELECT id FROM public_links WHERE user_id = ?)",
    "DELETE FROM public_links WHERE user_id = ?",
    "DELETE FROM provider_files WHERE user_id = ?",
    "DELETE FROM upload_sessions WHERE user_id = ?",
    "DELETE FROM file_shares WHERE owner_id = ?",
    "DELETE FROM files WHERE user_id = ?",
    "DELETE FROM storage_providers WHERE user_id = ?",
    "DELETE FROM api_keys WHERE user_id = ?",
    "DELETE FROM webhook_deliveries WHERE endpoint_id IN (SELECT id FROM webhook_endpoints WHERE user_id = ?)",
    "DELETE FROM webhook_endpoints WHERE user_id = ?",
    "DELETE FROM notifications WHERE user_id = ?",
    "DELETE FROM email_outbox WHERE user_id = ?",
    "DELETE FROM sessions WHERE user_id = ?",
    "DELETE FROM password_reset_tokens WHERE user_id = ?",
    "DELETE FROM email_verification_tokens WHERE user_id = ?",
    "DELETE FROM recovery_codes WHERE user_id = ?",
    "DELETE FROM mfa_challenges WHERE user_id = ?",
    "DELETE FROM user_identities WHERE user_id = ?",
    "DELETE FROM saved_searches WHERE user_id = ?",
    "DELETE FROM subscriptions WHERE user_id = ?",
    "DELETE FROM invoices WHERE user_id = ?",
    "DELETE FROM users WHERE id = ?",
  ];
  for (const sql of statements) {
    await run(env, sql, userId).catch(() => undefined);
  }
  await systemAudit(env, "account.purged", { user_id: userId });
}

/** Drops rows that only exist to support short-lived flows. */
export async function purgeExpiredEphemera(env: Env): Promise<Record<string, number>> {
  const cleanup: [string, string][] = [
    ["sessions", "DELETE FROM sessions WHERE datetime(expires_at) < datetime('now', '-7 days') OR (revoked_at IS NOT NULL AND datetime(revoked_at) < datetime('now', '-7 days'))"],
    ["oauth_states", "DELETE FROM oauth_states WHERE datetime(expires_at) < datetime('now')"],
    ["mfa_challenges", "DELETE FROM mfa_challenges WHERE datetime(expires_at) < datetime('now')"],
    ["password_resets", "DELETE FROM password_reset_tokens WHERE datetime(expires_at) < datetime('now', '-1 day')"],
    ["email_tokens", "DELETE FROM email_verification_tokens WHERE datetime(expires_at) < datetime('now', '-1 day')"],
    ["rate_limits", "DELETE FROM rate_limits WHERE expires_at < unixepoch()"],
    ["upload_sessions", "DELETE FROM upload_sessions WHERE datetime(expires_at) < datetime('now')"],
    ["link_visits", "DELETE FROM public_link_visits WHERE datetime(created_at) < datetime('now', '-180 days')"],
    ["deliveries", "DELETE FROM webhook_deliveries WHERE datetime(created_at) < datetime('now', '-30 days') AND status != 'pending'"],
    ["billing_events", "DELETE FROM billing_events WHERE datetime(created_at) < datetime('now', '-90 days') AND processed_at IS NOT NULL"],
    ["notifications", "DELETE FROM notifications WHERE read_at IS NOT NULL AND datetime(created_at) < datetime('now', '-90 days')"],
    ["outbox", "DELETE FROM email_outbox WHERE status = 'sent' AND datetime(created_at) < datetime('now', '-30 days')"],
    ["audit_logs", "DELETE FROM audit_logs WHERE datetime(created_at) < datetime('now', '-365 days')"],
  ];
  const counts: Record<string, number> = {};
  for (const [label, sql] of cleanup) {
    const result = await run(env, sql).catch(() => null);
    counts[label] = result?.meta.changes ?? 0;
  }
  return counts;
}
