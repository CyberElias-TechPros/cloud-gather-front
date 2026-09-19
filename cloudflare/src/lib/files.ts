/**
 * File and folder domain logic shared by the user API, the developer API and
 * the public share endpoints:
 *
 *  * naming rules (sanitising, de-duplication, path maintenance)
 *  * storage keys and R2 streaming with HTTP range support
 *  * quota accounting
 *  * trash, restore and permanent purge (including object cleanup)
 *  * folder archives as streamed ZIPs
 */

import { all, first, newId, nowIso, run } from "./db";
import { ApiError, badRequest, conflict, contentDisposition, notFound, payloadTooLarge, quotaExceeded } from "./http";
import { createZipStream, type ZipEntry } from "./zip";
import type { Env, FileRow, UserRow } from "../types";

export const FOLDER_MIME = "application/vnd.cloudgather.folder";

const KIND_EXTENSIONS: Record<string, string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg", "heic", "tiff"],
  video: ["mp4", "mov", "webm", "mkv", "avi", "m4v"],
  audio: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "opus"],
  pdf: ["pdf"],
  document: ["doc", "docx", "odt", "txt", "md", "rtf", "pages", "tex"],
  spreadsheet: ["xls", "xlsx", "csv", "tsv", "ods", "numbers"],
  presentation: ["ppt", "pptx", "key", "odp"],
  archive: ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"],
  code: ["js", "ts", "tsx", "jsx", "json", "html", "css", "py", "rb", "go", "rs", "java", "sh", "yml", "yaml", "toml", "sql"],
};

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "";
  return name.slice(index + 1).toLowerCase();
}

export function fileKind(row: Pick<FileRow, "is_folder" | "mime_type" | "name">): string {
  if (row.is_folder) return "folder";
  const mime = row.mime_type ?? "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  const extension = extensionOf(row.name);
  for (const [kind, extensions] of Object.entries(KIND_EXTENSIONS)) {
    if (extensions.includes(extension)) return kind;
  }
  return "other";
}

/**
 * Filenames are user input that ends up in storage keys, ZIP entries and
 * `Content-Disposition` headers, so control characters and path separators are
 * stripped. Leading `../` segments are dropped rather than escaped, and dotfiles
 * such as `.env` survive untouched.
 */
export function sanitizeName(input: string): string {
  let name = (input ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "-")
    .replace(/^(?:\.{1,2}-)+/, "")
    .replace(/^[-\s]+/, "")
    .replace(/[.\s]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!name || name === "." || name === "..") throw badRequest("That name is not allowed.");
  if (name.length > 200) {
    const extension = extensionOf(name);
    name = `${name.slice(0, 190 - extension.length)}${extension ? `.${extension}` : ""}`;
  }
  return name;
}

/** Appends ` (2)`, ` (3)` … until the name is free inside the folder. */
export async function uniqueName(env: Env, userId: string, parentId: string | null, name: string): Promise<string> {
  const existing = await all<{ name: string }>(
    env.DB,
    `SELECT name FROM files WHERE user_id = ? AND COALESCE(parent_id, '') = ? AND trashed_at IS NULL AND name LIKE ?`,
    userId,
    parentId ?? "",
    `${name.replace(/([%_\\])/g, "\\$1")}%`,
  );
  const taken = new Set(existing.map((row) => row.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;

  const extension = extensionOf(name);
  const stem = extension ? name.slice(0, -(extension.length + 1)) : name;
  for (let index = 2; index < 500; index++) {
    const candidate = extension ? `${stem} (${index}).${extension}` : `${stem} (${index})`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  throw conflict("Too many items share that name. Rename one of them first.");
}

export function buildPath(parentPath: string | null, name: string): string {
  const base = !parentPath || parentPath === "/" ? "" : parentPath.replace(/\/$/, "");
  return `${base}/${name}`;
}

/** Confirms a folder belongs to the user (or is the root, when `id` is null). */
export async function resolveParent(env: Env, userId: string, parentId: string | null | undefined): Promise<FileRow | null> {
  if (!parentId) return null;
  const folder = await first<FileRow>(env.DB, `SELECT * FROM files WHERE id = ? AND user_id = ?`, parentId, userId);
  if (!folder || folder.trashed_at) throw notFound("That folder no longer exists.");
  if (!folder.is_folder) throw badRequest("The destination is not a folder.");
  return folder;
}

export async function findFile(env: Env, userId: string, fileId: string): Promise<FileRow> {
  const file = await first<FileRow>(env.DB, `SELECT * FROM files WHERE id = ? AND user_id = ?`, fileId, userId);
  if (!file) throw notFound("That item no longer exists.");
  return file;
}

export function storageKeyFor(userId: string, fileId: string): string {
  return `${userId}/${fileId}`;
}

export interface FileDto {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string | null;
  isFolder: boolean;
  parentId: string | null;
  providerId: string | null;
  hosted: boolean;
  isStarred: boolean;
  trashedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shareCount: number;
  kind: string;
}

export function toFileDto(row: FileRow): FileDto {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    size: row.size,
    mimeType: row.is_folder ? FOLDER_MIME : row.mime_type,
    isFolder: Boolean(row.is_folder),
    parentId: row.parent_id,
    providerId: row.provider_id,
    hosted: Boolean(row.storage_key),
    isStarred: Boolean(row.starred),
    trashedAt: row.trashed_at,
    lastAccessedAt: row.last_accessed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    shareCount: row.share_count ?? 0,
    kind: fileKind(row),
  };
}

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

export async function usedBytes(env: Env, userId: string): Promise<number> {
  const row = await first<{ total: number | null }>(
    env.DB,
    `SELECT SUM(size) AS total FROM files WHERE user_id = ? AND is_folder = 0 AND trashed_at IS NULL`,
    userId,
  );
  return row?.total ?? 0;
}

export async function assertQuota(env: Env, user: UserRow, incomingBytes: number): Promise<void> {
  const used = await usedBytes(env, user.id);
  const quota = user.storage_quota_bytes;
  if (used + incomingBytes > quota) {
    throw quotaExceeded(
      `This upload would exceed your storage allowance (${Math.round((used + incomingBytes) / 1_048_576)} MB of ${Math.round(
        quota / 1_048_576,
      )} MB used). Free up space or ask an administrator for more.`,
    );
  }
}

export interface UploadLimits {
  maxFileSizeBytes: number;
  allowedExtensions: string[];
}

export function assertUploadAllowed(file: { name: string; size: number; type?: string }, limits: UploadLimits): void {
  if (file.size === 0) throw badRequest("That file is empty.");
  if (file.size > limits.maxFileSizeBytes) {
    throw payloadTooLarge(
      `${file.name} is ${(file.size / 1_048_576).toFixed(1)} MB. The limit for a single upload is ${Math.round(
        limits.maxFileSizeBytes / 1_048_576,
      )} MB.`,
    );
  }
  if (limits.allowedExtensions.length > 0) {
    const extension = extensionOf(file.name);
    if (!limits.allowedExtensions.includes(extension)) {
      throw new ApiError("unsupported_media_type", `.${extension || "?"} files are not accepted on this deployment.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export interface ListOptions {
  folderId?: string | null;
  search?: string;
  kind?: string;
  starred?: boolean;
  trashed?: boolean;
  sort?: "name" | "date" | "size" | "type";
  direction?: "asc" | "desc";
  limit?: number;
  offset?: number;
  host?: "hosted" | "linked";
  providerId?: string;
}

export interface ListResult {
  files: FileRow[];
  total: number;
}

/**
 * One query builder for every listing surface. Sorting is whitelisted — the
 * column name is never interpolated from user input.
 */
export async function listFiles(env: Env, userId: string, options: ListOptions = {}): Promise<ListResult> {
  const where: string[] = ["user_id = ?"];
  const bindings: unknown[] = [userId];

  if (options.trashed) {
    where.push("trashed_at IS NOT NULL");
  } else {
    where.push("trashed_at IS NULL");
    if (options.folderId) {
      where.push("parent_id = ?");
      bindings.push(options.folderId);
    } else if (options.folderId === null || options.folderId === undefined) {
      where.push("parent_id IS NULL");
    }
  }

  if (options.search) {
    where.push("name LIKE ? ESCAPE '\\'");
    bindings.push(`%${options.search.replace(/[\\%_]/g, "\\$&")}%`);
  }
  if (options.starred) where.push("starred = 1");
  if (options.providerId) {
    where.push("provider_id = ?");
    bindings.push(options.providerId);
  }
  if (options.host === "hosted") where.push("storage_key IS NOT NULL");
  if (options.host === "linked") where.push("storage_key IS NULL AND is_folder = 0");

  if (options.kind && options.kind !== "all") {
    const extensions = KIND_EXTENSIONS[options.kind];
    if (options.kind === "folder") {
      where.push("is_folder = 1");
    } else if (extensions && extensions.length > 0) {
      where.push(`(is_folder = 0 AND (${extensions.map(() => "lower(name) LIKE ?").join(" OR ")}))`);
      for (const extension of extensions) bindings.push(`%.${extension}`);
    } else if (options.kind === "other") {
      const known = Object.values(KIND_EXTENSIONS).flat();
      where.push(`(is_folder = 0 AND NOT (${known.map(() => "lower(name) LIKE ?").join(" OR ")}))`);
      for (const extension of known) bindings.push(`%.${extension}`);
    }
  }

  const clause = where.join(" AND ");
  const total = (
    await first<{ count: number }>(env.DB, `SELECT COUNT(*) AS count FROM files WHERE ${clause}`, ...bindings)
  )?.count ?? 0;

  const sortColumn =
    options.sort === "size" ? "size" : options.sort === "date" ? "updated_at" : options.sort === "type" ? "mime_type" : "name";
  const direction = options.direction === "desc" ? "DESC" : "ASC";
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const offset = Math.max(options.offset ?? 0, 0);

  const rows = await all<FileRow>(
    env.DB,
    `SELECT * FROM files WHERE ${clause} ORDER BY is_folder DESC, ${sortColumn} ${direction} LIMIT ? OFFSET ?`,
    ...bindings,
    limit,
    offset,
  );

  return { files: rows, total };
}

export async function breadcrumb(env: Env, userId: string, folderId: string | null): Promise<Array<{ id: string; name: string; path: string }>> {
  const trail: Array<{ id: string; name: string; path: string }> = [];
  let current = folderId;
  let guard = 0;
  while (current && guard < 64) {
    const folder = await first<FileRow>(env.DB, `SELECT id, name, path, parent_id FROM files WHERE id = ? AND user_id = ?`, current, userId);
    if (!folder) break;
    trail.unshift({ id: folder.id, name: folder.name, path: folder.path });
    current = folder.parent_id;
    guard += 1;
  }
  return trail;
}

/** Every descendant of a folder, using the materialised path. */
export async function descendants(env: Env, userId: string, folder: FileRow): Promise<FileRow[]> {
  return all<FileRow>(
    env.DB,
    `SELECT * FROM files WHERE user_id = ? AND path LIKE ? ESCAPE '\\'`,
    userId,
    `${folder.path.replace(/[\\%_]/g, "\\$1")}/%`,
  );
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface CreateFileInput {
  name: string;
  parentId?: string | null;
  isFolder?: boolean;
  size?: number;
  mimeType?: string | null;
  providerId?: string | null;
  providerFileId?: string | null;
  storageKey?: string | null;
  checksum?: string | null;
}

/**
 * Inserts the row first so the same transaction owns the storage key; the R2
 * write happens in the route and the row is rolled back if it fails.
 */
export async function createFile(env: Env, user: UserRow, input: CreateFileInput): Promise<FileRow> {
  const parent = await resolveParent(env, user.id, input.parentId ?? null);
  const name = await uniqueName(env, user.id, parent?.id ?? null, sanitizeName(input.name));
  const id = newId(input.isFolder ? "fld" : "fil");
  const path = buildPath(parent?.path ?? null, name);
  const timestamp = nowIso();

  await run(
    env.DB,
    `INSERT INTO files (id, user_id, parent_id, name, path, size, mime_type, is_folder, provider_id, provider_file_id, storage_key, checksum, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    parent?.id ?? null,
    name,
    path,
    input.isFolder ? 0 : (input.size ?? 0),
    input.isFolder ? FOLDER_MIME : (input.mimeType ?? null),
    input.isFolder ? 1 : 0,
    input.providerId ?? null,
    input.providerFileId ?? null,
    input.storageKey ?? null,
    input.checksum ?? null,
    timestamp,
    timestamp,
  );

  const row = await findFile(env, user.id, id);
  if (parent) await touch(env, parent.id);
  return row;
}

export async function touch(env: Env, fileId: string): Promise<void> {
  await run(env.DB, `UPDATE files SET updated_at = ? WHERE id = ?`, nowIso(), fileId);
}

export async function renameFile(env: Env, user: UserRow, file: FileRow, nextName: string): Promise<FileRow> {
  const name = await uniqueName(env, user.id, file.parent_id, sanitizeName(nextName));
  if (name === file.name) return file;

  const nextPath = buildPath(file.path.slice(0, file.path.length - file.name.length - 1) || null, name);
  const oldPath = file.path;
  const timestamp = nowIso();

  const statements = [
    env.DB.prepare(`UPDATE files SET name = ?, path = ?, updated_at = ? WHERE id = ?`).bind(name, nextPath, timestamp, file.id),
  ];

  if (file.is_folder) {
    // Descendant paths are materialised, so a rename has to rewrite the prefixes.
    statements.push(
      env.DB.prepare(
        `UPDATE files SET path = ? || substr(path, ?), updated_at = ? WHERE user_id = ? AND path LIKE ? ESCAPE '\\'`,
      ).bind(nextPath, oldPath.length + 1, timestamp, user.id, `${oldPath.replace(/[\\%_]/g, "\\$1")}/%`),
    );
  }

  await env.DB.batch(statements);
  return findFile(env, user.id, file.id);
}

export async function moveFile(env: Env, user: UserRow, file: FileRow, parentId: string | null): Promise<FileRow> {
  if (file.id === parentId) throw badRequest("An item cannot be moved inside itself.");
  const parent = await resolveParent(env, user.id, parentId);

  if (parent && file.is_folder && parent.path.startsWith(`${file.path}/`)) {
    throw badRequest("A folder cannot be moved inside its own subtree.");
  }

  const name = await uniqueName(env, user.id, parent?.id ?? null, file.name);
  const nextPath = buildPath(parent?.path ?? null, name);
  const oldPath = file.path;
  const timestamp = nowIso();

  const statements = [
    env.DB.prepare(`UPDATE files SET parent_id = ?, name = ?, path = ?, updated_at = ? WHERE id = ?`).bind(
      parent?.id ?? null,
      name,
      nextPath,
      timestamp,
      file.id,
    ),
  ];

  if (file.is_folder) {
    statements.push(
      env.DB.prepare(
        `UPDATE files SET path = ? || substr(path, ?), updated_at = ? WHERE user_id = ? AND path LIKE ? ESCAPE '\\'`,
      ).bind(nextPath, oldPath.length + 1, timestamp, user.id, `${oldPath.replace(/[\\%_]/g, "\\$1")}/%`),
    );
  }

  await env.DB.batch(statements);
  if (parent) await touch(env, parent.id);
  return findFile(env, user.id, file.id);
}

export interface TrashSummary {
  files: number;
  folders: number;
  bytes: number;
}

/** Trashes an item and everything beneath it, and disables its share links. */
export async function trashFile(env: Env, user: UserRow, file: FileRow): Promise<TrashSummary> {
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];
  const summary: TrashSummary = { files: file.is_folder ? 0 : 1, folders: file.is_folder ? 1 : 0, bytes: file.is_folder ? 0 : file.size };

  if (file.is_folder) {
    const children = await descendants(env, user.id, file);
    summary.files = children.filter((child) => !child.is_folder).length;
    summary.folders += children.filter((child) => child.is_folder).length;
    summary.bytes = children.reduce((total, child) => total + (child.is_folder ? 0 : child.size), 0);
    statements.push(
      env.DB.prepare(`UPDATE files SET trashed_at = ?, updated_at = ? WHERE user_id = ? AND path LIKE ? ESCAPE '\\' AND trashed_at IS NULL`).bind(
        timestamp,
        timestamp,
        user.id,
        `${file.path.replace(/[\\%_]/g, "\\$1")}/%`,
      ),
    );
  }

  statements.push(env.DB.prepare(`UPDATE files SET trashed_at = ?, updated_at = ? WHERE id = ?`).bind(timestamp, timestamp, file.id));
  statements.push(
    env.DB.prepare(`UPDATE shares SET revoked_at = ? WHERE owner_id = ? AND file_id = ? AND revoked_at IS NULL`).bind(
      timestamp,
      user.id,
      file.id,
    ),
  );
  await env.DB.batch(statements);
  return summary;
}

export async function restoreFile(env: Env, user: UserRow, file: FileRow): Promise<FileRow> {
  const timestamp = nowIso();
  const statements: D1PreparedStatement[] = [];

  if (file.is_folder) {
    statements.push(
      env.DB.prepare(`UPDATE files SET trashed_at = NULL, updated_at = ? WHERE user_id = ? AND path LIKE ? ESCAPE '\\'`).bind(
        timestamp,
        user.id,
        `${file.path.replace(/[\\%_]/g, "\\$1")}/%`,
      ),
    );
  }
  statements.push(env.DB.prepare(`UPDATE files SET trashed_at = NULL, updated_at = ? WHERE id = ?`).bind(timestamp, file.id));
  await env.DB.batch(statements);

  // If the original parent is gone, restore to the root instead of orphaning it.
  const parent = file.parent_id
    ? await first<FileRow>(env.DB, `SELECT * FROM files WHERE id = ? AND user_id = ?`, file.parent_id, user.id)
    : null;
  if (file.parent_id && (!parent || parent.trashed_at)) {
    return moveFile(env, user, await findFile(env, user.id, file.id), null);
  }
  return findFile(env, user.id, file.id);
}

export interface PurgeSummary {
  rows: number;
  objects: number;
  bytes: number;
}

/** Irreversible: removes rows, R2 objects and share links. */
export async function purgeFile(env: Env, user: UserRow, file: FileRow): Promise<PurgeSummary> {
  const targets = file.is_folder ? [...(await descendants(env, user.id, file)), file] : [file];
  return purgeRows(env, user, targets);
}

async function purgeRows(env: Env, user: UserRow, rows: FileRow[]): Promise<PurgeSummary> {
  const objectKeys = rows.filter((row) => row.storage_key).map((row) => row.storage_key as string);
  const ids = rows.map((row) => row.id);
  const bytes = rows.reduce((total, row) => total + (row.is_folder ? 0 : row.size), 0);

  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`DELETE FROM shares WHERE file_id IN (${ids.map(() => "?").join(",")})`).bind(...ids),
    // Folders first so the self-referencing foreign key never blocks the delete.
    env.DB.prepare(`DELETE FROM files WHERE id IN (${ids.map(() => "?").join(",")})`).bind(...ids),
  ];
  await env.DB.batch(statements);

  let removedObjects = 0;
  for (let index = 0; index < objectKeys.length; index += 100) {
    const chunk = objectKeys.slice(index, index + 100);
    try {
      await env.FILES.delete(chunk);
      removedObjects += chunk.length;
    } catch (error) {
      // The row is already gone; log so the sweeper can find the orphan.
      console.error("[files] R2 cleanup failed", error instanceof Error ? error.message : error, chunk.slice(0, 3));
    }
  }

  return { rows: ids.length, objects: removedObjects, bytes };
}

export async function emptyTrash(env: Env, user: UserRow): Promise<PurgeSummary> {
  const rows = await all<FileRow>(env.DB, `SELECT * FROM files WHERE user_id = ? AND trashed_at IS NOT NULL`, user.id);
  if (rows.length === 0) return { rows: 0, objects: 0, bytes: 0 };
  return purgeRows(env, user, rows);
}

export async function purgeExpiredTrash(env: Env, retentionDays: number): Promise<{ users: number; rows: number }> {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const stale = await all<FileRow>(
    env.DB,
    `SELECT * FROM files WHERE trashed_at IS NOT NULL AND trashed_at < ? ORDER BY path LIMIT 2000`,
    cutoff,
  );
  if (stale.length === 0) return { users: 0, rows: 0 };

  const byUser = new Map<string, FileRow[]>();
  for (const row of stale) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  let rows = 0;
  for (const [userId, items] of byUser) {
    const user = { id: userId } as UserRow;
    const summary = await purgeRows(env, user, items);
    rows += summary.rows;
  }
  return { users: byUser.size, rows };
}

// ---------------------------------------------------------------------------
// Reading bytes
// ---------------------------------------------------------------------------

export interface StreamOptions {
  range?: { offset: number; length: number };
  disposition?: "inline" | "attachment";
  cacheSeconds?: number;
}

/** Streams a stored object, honouring byte ranges for video and audio seeking. */
export async function streamStoredFile(env: Env, row: FileRow, options: StreamOptions = {}): Promise<Response> {
  if (!row.storage_key) throw notFound("That file is not stored here.");

  const object = await env.FILES.get(row.storage_key, options.range ? { range: options.range } : undefined);
  if (!object) throw notFound("The stored file is missing. It may have been deleted.");

  const headers = new Headers();
  headers.set("content-type", row.mime_type || object.httpMetadata?.contentType || "application/octet-stream");
  headers.set("content-disposition", contentDisposition(row.name, options.disposition ?? "attachment"));
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("last-modified", object.uploaded.toUTCString());
  headers.set("cache-control", options.cacheSeconds ? `private, max-age=${options.cacheSeconds}` : "private, no-store");

  const range = options.range;
  if (range) {
    // R2 reports how much of the object it actually returned.
    const length = (object.range as { length?: number } | undefined)?.length ?? object.size;
    headers.set("content-range", `bytes ${range.offset}-${range.offset + length - 1}/${row.size}`);
    headers.set("content-length", String(length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("content-length", String(object.size));
  return new Response(object.body, { status, headers });
}

export async function markAccessed(env: Env, fileId: string): Promise<void> {
  await run(env.DB, `UPDATE files SET last_accessed_at = ? WHERE id = ?`, nowIso(), fileId);
}

// ---------------------------------------------------------------------------
// Folder archives
// ---------------------------------------------------------------------------

export async function folderZipResponse(env: Env, folder: FileRow, rows: FileRow[], archiveName: string): Promise<Response> {
  const prefix = folder.path === "/" ? "" : folder.path;
  const entries: ZipEntry[] = rows
    .filter((row) => !row.is_folder)
    .map((row) => {
      const relative = row.path.startsWith(prefix) ? row.path.slice(prefix.length).replace(/^\//, "") : row.name;
      return {
        name: relative || row.name,
        size: row.size,
        modifiedAt: new Date(row.updated_at),
        open: async () => {
          if (!row.storage_key) return null;
          const object = await env.FILES.get(row.storage_key);
          return object?.body ?? null;
        },
      } satisfies ZipEntry;
    });

  if (entries.length === 0) throw badRequest("That folder is empty, so there is nothing to download.");

  const stream = createZipStream(entries);
  return new Response(stream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": contentDisposition(`${archiveName}.zip`, "attachment"),
      "cache-control": "private, no-store",
    },
  });
}

export function folderFileCount(rows: FileRow[]): number {
  return rows.filter((row) => !row.is_folder).length;
}
