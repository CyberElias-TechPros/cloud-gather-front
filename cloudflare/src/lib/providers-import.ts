/**
 * Queue worker for `provider.import` jobs.
 *
 * Importing means: fetch the bytes from the connected drive, store them in
 * CloudGather storage (R2) and register the file. A job per file keeps one bad
 * object from stalling an entire folder, and the work is idempotent — re-running
 * a job overwrites the object rather than creating a duplicate row.
 */

import { createFile, storageKeyFor, usedBytes } from "./files";
import { all, first, newId, nowIso, run, stringifyJson } from "./db";
import { fetchRemoteFile } from "./providers";
import { record } from "./events";
import type { Env, ProviderRow, UserRow } from "../types";

export interface ImportJob {
  type: "provider.import";
  userId: string;
  providerId: string;
  providerFileId: string;
  name: string;
  size: number;
  mimeType: string | null;
  parentId: string | null;
}

/** Imports are capped so a single job can never exhaust a Worker's memory. */
const MAX_IMPORT_BYTES = 200 * 1024 * 1024;

async function notify(env: Env, userId: string, title: string, body: string, link: string | null = null): Promise<void> {
  await run(
    env.DB,
    `INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?, ?, 'import', ?, ?, ?, ?)`,
    newId("ntf"),
    userId,
    title,
    body,
    link,
    nowIso(),
  ).catch(() => undefined);
}

export async function handleImportJob(env: Env, job: ImportJob): Promise<void> {
  const [user, provider] = await Promise.all([
    first<UserRow>(env.DB, `SELECT * FROM users WHERE id = ?`, job.userId),
    first<ProviderRow>(env.DB, `SELECT * FROM providers WHERE id = ? AND user_id = ?`, job.providerId, job.userId),
  ]);

  // The account or drive disappeared while the job waited — nothing to do.
  if (!user || !provider) {
    console.warn(`[import] dropping job ${job.providerFileId}: account or drive no longer exists`);
    return;
  }
  if (user.status !== "active") return;

  if (!job.size || job.size > MAX_IMPORT_BYTES) {
    await notify(env, user.id, "Import skipped", `${job.name} is larger than the import limit (${Math.round(MAX_IMPORT_BYTES / 1_048_576)} MB).`);
    return;
  }

  const used = await usedBytes(env, user.id);
  if (used + job.size > user.storage_quota_bytes) {
    await notify(env, user.id, "Import skipped", `${job.name} would exceed your storage allowance.`);
    return;
  }

  const response = await fetchRemoteFile(env, provider, job.providerFileId);
  if (!response.ok || !response.body) {
    throw new Error(`provider returned ${response.status} for ${job.providerFileId}`);
  }

  // Buffered deliberately: R2 wants a body of known length, and imports are
  // bounded above so this cannot grow without limit.
  const buffer = await response.arrayBuffer();
  const mimeType = job.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream";

  const row = await createFile(env, user, {
    name: job.name,
    parentId: job.parentId,
    size: buffer.byteLength,
    mimeType,
    providerId: provider.id,
    providerFileId: job.providerFileId,
  });

  const key = storageKeyFor(user.id, row.id);
  await env.FILES.put(key, buffer, {
    httpMetadata: { contentType: mimeType },
    customMetadata: {
      userId: user.id,
      fileId: row.id,
      importedFrom: provider.provider_name,
      providerFileId: job.providerFileId,
    },
  });

  await run(env.DB, `UPDATE files SET storage_key = ?, updated_at = ? WHERE id = ?`, key, nowIso(), row.id);

  await record(env, {
    action: "provider.imported",
    userId: user.id,
    resourceType: "file",
    resourceId: row.id,
    details: { provider: provider.provider_name, name: job.name, bytes: buffer.byteLength },
  });

  await notify(env, user.id, "Import finished", `${job.name} is now available in CloudGather storage.`, "/files");
}

/** Diagnostics for the admin console: how much is still queued for an account. */
export async function pendingImports(env: Env, userId: string): Promise<number> {
  const rows = await all<{ count: number }>(
    env.DB,
    `SELECT COUNT(*) AS count FROM files WHERE user_id = ? AND storage_key IS NULL AND is_folder = 0`,
    userId,
  );
  return rows[0]?.count ?? 0;
}

export { stringifyJson };
