/** Shared file-tree logic: paths, unique naming, trash and version retention. */
import type { Env } from "../env";
import type { Ctx } from "../core/context";
import { all, first, run } from "../core/db";
import { conflict, notFound } from "../core/http";
import { fileCategory, id, now, splitExtension } from "../core/util";

export interface FileRow {
  id: string;
  user_id: string;
  filename: string;
  path: string;
  size: number;
  mime_type: string | null;
  is_folder: number;
  is_starred: number;
  is_shared: number;
  parent_folder_id: string | null;
  provider_id: string | null;
  provider_file_id: string | null;
  storage_kind: string;
  r2_key: string | null;
  checksum: string | null;
  version: number;
  thumbnail_key: string | null;
  last_accessed_at: string | null;
  download_count: number;
  description: string | null;
  tags: string;
  category: string | null;
  provider_path: string | null;
  provider_modified_at: string | null;
  web_url: string | null;
  deleted_at: string | null;
  purge_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FILE_COLUMNS = "*";

export async function getFile(env: Env, userId: string, fileId: string, { includeTrashed = false } = {}): Promise<FileRow> {
  const row = await first<FileRow>(
    env,
    `SELECT * FROM files WHERE id = ? AND user_id = ?${includeTrashed ? "" : " AND deleted_at IS NULL"}`,
    fileId,
    userId,
  );
  if (!row) throw notFound("That file or folder no longer exists.", "file_not_found");
  return row;
}

export async function getFolder(env: Env, userId: string, folderId: string): Promise<FileRow> {
  const row = await first<FileRow>(
    env,
    "SELECT * FROM files WHERE id = ? AND user_id = ? AND is_folder = 1 AND deleted_at IS NULL",
    folderId,
    userId,
  );
  if (!row) throw notFound("That folder no longer exists.", "folder_not_found");
  return row;
}

export async function folderPath(env: Env, userId: string, parentFolderId: string | null): Promise<string> {
  if (!parentFolderId) return "";
  const parent = await getFolder(env, userId, parentFolderId);
  return parent.path;
}

/** Returns a name that does not collide in the destination folder. */
export async function uniqueName(env: Env, userId: string, parentFolderId: string | null, desired: string): Promise<string> {
  const { base, ext } = splitExtension(desired);
  let candidate = desired;
  for (let attempt = 1; attempt <= 200; attempt += 1) {
    const clash = await first<{ id: string }>(
      env,
      `SELECT id FROM files WHERE user_id = ? AND COALESCE(parent_folder_id,'') = ? AND filename = ? AND deleted_at IS NULL`,
      userId,
      parentFolderId || "",
      candidate,
    );
    if (!clash) return candidate;
    candidate = `${base} (${attempt})${ext}`;
  }
  throw conflict("Too many items with that name in this folder.", "name_conflict");
}

export async function assertNameAvailable(env: Env, userId: string, parentFolderId: string | null, name: string, ignoreId?: string) {
  const clash = await first<{ id: string }>(
    env,
    `SELECT id FROM files WHERE user_id = ? AND COALESCE(parent_folder_id,'') = ? AND filename = ? AND deleted_at IS NULL${ignoreId ? " AND id != ?" : ""}`,
    userId,
    parentFolderId || "",
    name,
    ...(ignoreId ? [ignoreId] : []),
  );
  if (clash) throw conflict("An item with this name already exists here.", "name_conflict");
}

/** Prevents moving a folder inside its own subtree. */
export async function assertNotDescendant(env: Env, userId: string, folderId: string, targetParentId: string | null): Promise<void> {
  if (!targetParentId) return;
  if (folderId === targetParentId) throw conflict("A folder cannot be moved into itself.", "invalid_move");
  let cursor: string | null = targetParentId;
  for (let depth = 0; depth < 64 && cursor; depth += 1) {
    const row: { parent_folder_id: string | null } | null = await first<{ parent_folder_id: string | null }>(
      env,
      "SELECT parent_folder_id FROM files WHERE id = ? AND user_id = ?",
      cursor,
      userId,
    );
    if (!row) return;
    if (row.parent_folder_id === folderId) throw conflict("A folder cannot be moved into one of its own subfolders.", "invalid_move");
    cursor = row.parent_folder_id;
  }
}

/** Rewrites descendant paths after a rename or move. */
export async function repathDescendants(env: Env, userId: string, oldPath: string, newPath: string): Promise<void> {
  await run(
    env,
    "UPDATE files SET path = ? || substr(path, ?), updated_at = ? WHERE user_id = ? AND path LIKE ?",
    newPath,
    oldPath.length + 1,
    now(),
    userId,
    `${oldPath}/%`,
  );
}

export async function descendantIds(env: Env, userId: string, folder: FileRow): Promise<string[]> {
  const rows = await all<{ id: string }>(env, "SELECT id FROM files WHERE user_id = ? AND path LIKE ?", userId, `${folder.path}/%`);
  return rows.map((row) => row.id);
}

/** Soft-deletes a file/folder and everything under it. */
export async function trashItem(env: Env, userId: string, file: FileRow, retentionDays: number): Promise<number> {
  const purgeAt = new Date(Date.now() + Math.max(1, retentionDays) * 86_400_000).toISOString();
  const ids = file.is_folder ? [file.id, ...(await descendantIds(env, userId, file))] : [file.id];
  for (let index = 0; index < ids.length; index += 40) {
    const slice = ids.slice(index, index + 40);
    await env.DB.batch(
      slice.map((rowId) =>
        env.DB.prepare("UPDATE files SET deleted_at = ?, purge_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL").bind(
          now(),
          purgeAt,
          now(),
          rowId,
          userId,
        ),
      ),
    );
  }
  return ids.length;
}

/** Restores a trashed item, re-parenting to root when the parent is gone. */
export async function restoreItem(env: Env, userId: string, file: FileRow): Promise<FileRow> {
  let parentId = file.parent_folder_id;
  if (parentId) {
    const parent = await first<{ id: string; path: string }>(
      env,
      "SELECT id, path FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
      parentId,
      userId,
    );
    if (!parent) parentId = null;
  }
  const name = await uniqueName(env, userId, parentId, file.filename);
  const basePath = parentId ? (await getFolder(env, userId, parentId)).path : "";
  const newPath = `${basePath}/${name}`;

  await run(
    env,
    "UPDATE files SET deleted_at = NULL, purge_at = NULL, parent_folder_id = ?, filename = ?, path = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    parentId,
    name,
    newPath,
    now(),
    file.id,
    userId,
  );
  if (file.is_folder) {
    await run(
      env,
      "UPDATE files SET deleted_at = NULL, purge_at = NULL, path = ? || substr(path, ?), updated_at = ? WHERE user_id = ? AND path LIKE ?",
      newPath,
      file.path.length + 1,
      now(),
      userId,
      `${file.path}/%`,
    );
  }
  return getFile(env, userId, file.id);
}

/** Permanently removes rows and their R2 objects. */
export async function purgeItems(env: Env, userId: string, fileIds: string[]): Promise<number> {
  if (!fileIds.length) return 0;
  let removed = 0;
  for (const fileId of fileIds) {
    const row = await first<FileRow>(env, "SELECT * FROM files WHERE id = ? AND user_id = ?", fileId, userId);
    if (!row) continue;
    const keys: string[] = [];
    if (row.is_folder) {
      const descendants = await all<{ r2_key: string | null; thumbnail_key: string | null }>(
        env,
        "SELECT r2_key, thumbnail_key FROM files WHERE user_id = ? AND path LIKE ?",
        userId,
        `${row.path}/%`,
      );
      for (const descendant of descendants) {
        if (descendant.r2_key) keys.push(descendant.r2_key);
        if (descendant.thumbnail_key) keys.push(descendant.thumbnail_key);
      }
    }
    if (row.r2_key) keys.push(row.r2_key);
    if (row.thumbnail_key) keys.push(row.thumbnail_key);

    const versions = await all<{ r2_key: string }>(env, "SELECT r2_key FROM file_versions WHERE file_id = ?", fileId);
    keys.push(...versions.map((version) => version.r2_key));

    for (const key of keys) await env.FILES.delete(key).catch(() => undefined);
    await run(env, "DELETE FROM files WHERE id = ? AND user_id = ?", fileId, userId);
    removed += 1;
  }
  return removed;
}

/** Stores the previous content of a file as a version and enforces retention. */
export async function snapshotVersion(env: Env, file: FileRow, keep: number, note?: string): Promise<void> {
  if (!file.r2_key || file.is_folder) return;
  const versionKey = `${file.user_id}/${file.id}/versions/${file.version}-${crypto.randomUUID().slice(0, 8)}`;
  const existing = await env.FILES.get(file.r2_key);
  if (!existing) return;
  await env.FILES.put(versionKey, existing.body, { httpMetadata: { contentType: file.mime_type || "application/octet-stream" } });
  await run(
    env,
    `INSERT INTO file_versions(id, file_id, user_id, version, size, mime_type, r2_key, checksum, note)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id(),
    file.id,
    file.user_id,
    file.version,
    file.size,
    file.mime_type,
    versionKey,
    file.checksum,
    note ?? null,
  );

  const stale = await all<{ id: string; r2_key: string }>(
    env,
    "SELECT id, r2_key FROM file_versions WHERE file_id = ? ORDER BY version DESC LIMIT -1 OFFSET ?",
    file.id,
    Math.max(1, keep),
  );
  for (const version of stale) {
    await env.FILES.delete(version.r2_key).catch(() => undefined);
    await run(env, "DELETE FROM file_versions WHERE id = ?", version.id);
  }
}

export const managedKey = (userId: string, fileId: string, filename: string) =>
  `${userId}/${fileId}/${filename.replace(/[^\w.\-() ]/g, "_")}`;

export function publicFile(row: FileRow) {
  return {
    id: row.id,
    user_id: row.user_id,
    filename: row.filename,
    path: row.path,
    size: Number(row.size || 0),
    mime_type: row.mime_type,
    is_folder: Boolean(row.is_folder),
    is_starred: Boolean(row.is_starred),
    is_shared: Boolean(row.is_shared),
    parent_folder_id: row.parent_folder_id,
    provider_id: row.provider_id,
    provider_file_id: row.provider_file_id,
    storage_kind: row.storage_kind,
    version: Number(row.version || 1),
    description: row.description,
    tags: JSON.parse(row.tags || "[]") as string[],
    category: row.category || fileCategory(row.mime_type, Boolean(row.is_folder)),
    web_url: row.web_url,
    last_accessed_at: row.last_accessed_at,
    download_count: Number(row.download_count || 0),
    deleted_at: row.deleted_at,
    purge_at: row.purge_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function touchFile(ctx: Ctx, fileId: string): Promise<void> {
  ctx.waitUntil(
    run(ctx.env, "UPDATE files SET last_accessed_at = ? WHERE id = ?", now(), fileId).then(
      () => undefined,
      () => undefined,
    ),
  );
}
