/**
 * Files and folders — the core of the product.
 *
 * The storage strategy is deliberately simple: metadata lives in D1, bytes live
 * in R2 under `<userId>/<fileId>`. Because the key is the file id, renaming or
 * moving a file never touches the object, and permanent deletion always knows
 * exactly which objects to remove.
 */

import {
  asFile,
  assertQuota,
  assertUploadAllowed,
  breadcrumb,
  createFile,
  descendants,
  emptyTrash,
  findFile,
  folderZipResponse,
  listFiles,
  markAccessed,
  moveFile,
  purgeFile,
  renameFile,
  restoreFile,
  storageKeyFor,
  streamStoredFile,
  toFileDto,
  trashFile,
  usedBytes,
  type ListOptions,
} from "../lib/files";
import { currentUser } from "../lib/auth";
import { all, nowIso, run } from "../lib/db";
import { sha256Base64 } from "../lib/crypto";
import { ApiError, badRequest, created, json, notFound, type Ctx } from "../lib/http";
import { record, recordUsage } from "../lib/events";
import { enforceRateLimit } from "../lib/ratelimit";
import { getSettings, numericSetting } from "../lib/settings";
import { optionalArray, optionalBool, queryBool, queryInt, queryValue } from "../lib/validate";
import type { FileRow, UserRow } from "../types";

const CHECKSUM_LIMIT_BYTES = 8 * 1024 * 1024;

export function parseRange(value: string | null, size: number): { offset: number; length: number } | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return null;
  const [, startRaw, endRaw] = match;

  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    const suffix = Number(endRaw);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, size);
    return { offset: Math.max(0, size - length), length };
  }

  const start = Number(startRaw);
  if (!Number.isFinite(start) || start >= size) return null;
  const end = endRaw === "" ? size - 1 : Number(endRaw);
  if (!Number.isFinite(end) || end < start) return null;
  const clampedEnd = Math.min(end, size - 1);
  return { offset: start, length: clampedEnd - start + 1 };
}

function parseListOptions(ctx: Ctx): ListOptions {
  const url = ctx.url;
  const folderParam = url.searchParams.get("folderId");
  return {
    folderId: folderParam === "root" || folderParam === "" ? null : folderParam ?? null,
    explicitFolder: folderParam !== null,
    search: queryValue(url, "search"),
    kind: queryValue(url, "kind"),
    starred: queryBool(url, "starred"),
    trashed: queryBool(url, "trashed"),
    sort: (queryValue(url, "sort") as ListOptions["sort"]) ?? "name",
    direction: (queryValue(url, "direction") as ListOptions["direction"]) ?? "asc",
    limit: queryInt(url, "limit", { fallback: 100, min: 1, max: 500 }),
    offset: queryInt(url, "offset", { fallback: 0, min: 0 }),
    host: queryValue(url, "host") as ListOptions["host"],
    providerId: queryValue(url, "providerId"),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function list(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const options = parseListOptions(ctx);

  if (options.folderId && !options.trashed && !options.search) {
    await findFile(ctx.env, user.id, options.folderId).then((folder) => {
      if (!folder.is_folder) throw badRequest("That is a file, not a folder.");
    });
  }

  const [{ files, total }, quotaBytes] = await Promise.all([
    listFiles(ctx.env, user.id, options),
    Promise.resolve(user.storage_quota_bytes),
  ]);

  const trail = options.folderId ? await breadcrumb(ctx.env, user.id, options.folderId) : [];

  return json({
    files: files.map(toFileDto),
    total,
    limit: options.limit,
    offset: options.offset ?? 0,
    hasMore: (options.offset ?? 0) + files.length < total,
    breadcrumb: trail,
    quotaBytes,
  });
}

export async function tree(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const folders = await all<FileRow>(
    ctx.env.DB,
    `SELECT * FROM files WHERE user_id = ? AND is_folder = 1 AND trashed_at IS NULL ORDER BY path COLLATE NOCASE`,
    user.id,
  );

  const counts = await all<{ parent_id: string; count: number }>(
    ctx.env.DB,
    `SELECT parent_id, COUNT(*) AS count FROM files WHERE user_id = ? AND trashed_at IS NULL AND parent_id IS NOT NULL GROUP BY parent_id`,
    user.id,
  );
  const countByParent = new Map(counts.map((row) => [row.parent_id, row.count]));

  return json({
    folders: folders.map((folder, index) => ({
      id: folder.id,
      name: folder.name,
      path: folder.path,
      parentId: folder.parent_id,
      childCount: countByParent.get(folder.id) ?? 0,
      depth: folder.path.split("/").filter(Boolean).length - 1,
      order: index,
    })),
    rootCount: countByParent.get(null as unknown as string) ?? 0,
  });
}

export async function recent(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const limit = queryInt(ctx.url, "limit", { fallback: 60, min: 1, max: 200 });
  const files = await all<FileRow>(
    ctx.env.DB,
    `SELECT * FROM files
      WHERE user_id = ? AND trashed_at IS NULL AND is_folder = 0
      ORDER BY COALESCE(last_accessed_at, updated_at) DESC LIMIT ?`,
    user.id,
    limit,
  );
  return json({ files: files.map(toFileDto) });
}

export async function stats(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);

  const [totals, byKind, byProvider, providers, usage, trash] = await Promise.all([
    all<{ kind: string; count: number; bytes: number }>(
      ctx.env.DB,
      `SELECT CASE WHEN is_folder = 1 THEN 'folder' ELSE COALESCE(NULLIF(mime_type, ''), 'application/octet-stream') END AS kind,
              COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes
         FROM files WHERE user_id = ? AND trashed_at IS NULL GROUP BY kind`,
      user.id,
    ),
    all<{ category: string; count: number; bytes: number }>(
      ctx.env.DB,
      `SELECT
         CASE
           WHEN is_folder = 1 THEN 'folder'
           WHEN mime_type LIKE 'image/%' THEN 'image'
           WHEN mime_type LIKE 'video/%' THEN 'video'
           WHEN mime_type LIKE 'audio/%' THEN 'audio'
           WHEN mime_type = 'application/pdf' THEN 'pdf'
           WHEN lower(name) LIKE '%.doc%' OR lower(name) LIKE '%.txt' OR lower(name) LIKE '%.rtf' THEN 'document'
           WHEN lower(name) LIKE '%.xls%' OR lower(name) LIKE '%.csv' THEN 'spreadsheet'
           WHEN lower(name) LIKE '%.ppt%' THEN 'presentation'
           WHEN lower(name) LIKE '%.zip' OR lower(name) LIKE '%.rar' OR lower(name) LIKE '%.7z' OR lower(name) LIKE '%.tar%' THEN 'archive'
           ELSE 'other'
         END AS category,
         COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes
       FROM files WHERE user_id = ? AND trashed_at IS NULL GROUP BY category ORDER BY bytes DESC`,
      user.id,
    ),
    all<{ provider_id: string | null; bytes: number; count: number }>(
      ctx.env.DB,
      `SELECT provider_id, COALESCE(SUM(size), 0) AS bytes, COUNT(*) AS count
         FROM files WHERE user_id = ? AND trashed_at IS NULL AND is_folder = 0 GROUP BY provider_id`,
      user.id,
    ),
    all<Record<string, unknown>>(
      ctx.env.DB,
      `SELECT p.id, p.provider_name, p.display_name, p.status, p.total_space, p.used_space, p.priority, p.account_email,
              COUNT(f.id) AS file_count, COALESCE(SUM(f.size), 0) AS indexed_bytes
         FROM providers p LEFT JOIN files f ON f.provider_id = p.id AND f.trashed_at IS NULL
        WHERE p.user_id = ? GROUP BY p.id ORDER BY p.priority ASC, p.created_at ASC`,
      user.id,
    ),
    all<Record<string, unknown>>(
      ctx.env.DB,
      `SELECT * FROM usage_daily WHERE user_id = ? ORDER BY day DESC LIMIT 30`,
      user.id,
    ),
    all<{ count: number; bytes: number }>(
      ctx.env.DB,
      `SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM files WHERE user_id = ? AND trashed_at IS NOT NULL`,
      user.id,
    ),
  ]);

  const used = totals.filter((row) => row.kind !== "folder").reduce((total, row) => total + row.bytes, 0);
  const fileCount = totals.filter((row) => row.kind !== "folder").reduce((total, row) => total + row.count, 0);
  const folderCount = totals.filter((row) => row.kind === "folder").reduce((total, row) => total + row.count, 0);

  return json({
    summary: {
      usedBytes: used,
      quotaBytes: user.storage_quota_bytes,
      indexedBytes: byProvider.reduce((total, row) => total + row.bytes, 0),
      trashedBytes: trash[0]?.bytes ?? 0,
      fileCount,
      folderCount,
      trashCount: trash[0]?.count ?? 0,
      byKind,
    },
    providers,
    byProvider,
    usage,
    percentUsed: user.storage_quota_bytes > 0 ? Math.min(100, (used / user.storage_quota_bytes) * 100) : 0,
  });
}

export async function get(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const file = await findFile(ctx.env, user.id, ctx.params.id);
  return json({ file: toFileDto(file) });
}

export async function path(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const file = await findFile(ctx.env, user.id, ctx.params.id);
  return json({ breadcrumb: await breadcrumb(ctx.env, user.id, file.is_folder ? file.id : file.parent_id) });
}

export async function download(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const file = await findFile(ctx.env, user.id, ctx.params.id);
  if (file.is_folder) return folderArchive(ctx, user, file);

  if (!file.storage_key) {
    throw new ApiError(
      "conflict",
      "This file lives in a connected drive. Download it from the drive itself, or import it into CloudGather first.",
    );
  }

  const rangeHeader = ctx.req.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, file.size) : null;
  const response = await streamStoredFile(ctx.env, file, { range: range ?? undefined, disposition: "attachment" });
  await markAccessed(ctx.env, file.id);
  await record(ctx.env, { action: "file.downloaded", user, resourceType: "file", resourceId: file.id, ctx, usage: { downloads: 1, bytes_downloaded: file.size } });
  return response;
}

export async function preview(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const file = await findFile(ctx.env, user.id, ctx.params.id);
  if (file.is_folder) throw badRequest("Folders cannot be previewed.");

  if (!file.storage_key) {
    throw new ApiError("conflict", "This file lives in a connected drive and has not been imported yet.");
  }

  const inline = isInlineSafe(file.mime_type, file.name);
  const rangeHeader = ctx.req.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader, file.size) : null;

  const response = await streamStoredFile(ctx.env, file, {
    range: range ?? undefined,
    disposition: inline ? "inline" : "attachment",
  });
  await markAccessed(ctx.env, file.id);
  return response;
}

/** SVG and HTML can execute script in the origin that serves them. */
function isInlineSafe(mimeType: string | null, name: string): boolean {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("svg") || mime.includes("html") || mime.includes("xml") || mime.includes("javascript")) return false;
  if (/\.(svg|html?|xhtml|js|mjs)$/i.test(name)) return false;
  return /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/|audio\/|text\/plain|application\/pdf)/.test(mime);
}

async function folderArchive(ctx: Ctx, user: UserRow, folder: FileRow): Promise<Response> {
  const children = await descendants(ctx.env, user.id, folder);
  const response = await folderZipResponse(ctx.env, folder, children, folder.name);
  await record(ctx.env, {
    action: "file.folder_downloaded",
    user,
    resourceType: "folder",
    resourceId: folder.id,
    ctx,
    details: { files: children.filter((child) => !child.is_folder).length },
  });
  return response;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createFolder(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = typeof input.name === "string" ? input.name : "";
  if (!name.trim()) throw badRequest("Give the folder a name.");

  const folder = await createFile(ctx.env, user, {
    name,
    parentId: (input.parentId as string | null) ?? null,
    isFolder: true,
  });

  await record(ctx.env, { action: "file.folder_created", user, resourceType: "folder", resourceId: folder.id, ctx, details: { name: folder.name } });
  return created({ folder: toFileDto(folder) });
}

export async function upload(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const settings = await getSettings(ctx.env);

  await enforceRateLimit(
    ctx.env,
    {
      scope: "upload",
      limit: numericSetting(settings, "upload_rate_limit_per_hour", 300),
      windowSeconds: 3600,
      identifier: user.id,
    },
    "You have reached the hourly upload limit. Please try again in a little while.",
  );

  const limits = {
    maxFileSizeBytes: numericSetting(settings, "max_file_size_mb", 100) * 1024 * 1024,
    allowedExtensions: String(settings.allowed_file_types ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  };

  let file: File | null = null;
  let parentId: string | null = null;
  const contentType = ctx.req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await ctx.req.formData();
    } catch {
      throw badRequest("The upload could not be read. Please try again.");
    }
    file = asFile(form.get("file"));
    const parent = form.get("parentId");
    parentId = typeof parent === "string" && parent ? parent : null;
  } else {
    // Raw body upload: the name arrives in a header (used by the developer API).
    const headerName = ctx.req.headers.get("x-file-name");
    if (!headerName) throw badRequest("Send the file as multipart/form-data, or set the x-file-name header.");
    const buffer = await ctx.req.arrayBuffer();
    file = new File([buffer], decodeURIComponent(headerName), {
      type: ctx.req.headers.get("content-type") ?? "application/octet-stream",
    });
    const parent = ctx.url.searchParams.get("parentId");
    parentId = parent && parent !== "root" ? parent : null;
  }

  if (!file) throw badRequest("No file was included in the request.");

  assertUploadAllowed({ name: file.name, size: file.size, type: file.type }, limits);
  await assertQuota(ctx.env, user, file.size);

  const row = await createFile(ctx.env, user, {
    name: file.name,
    parentId,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  });

  const key = storageKeyFor(user.id, row.id);
  try {
    await ctx.env.FILES.put(key, file, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { userId: user.id, fileId: row.id, originalName: encodeURIComponent(file.name) },
    });
  } catch (error) {
    // Never leave a row pointing at bytes that do not exist.
    await run(ctx.env.DB, `DELETE FROM files WHERE id = ?`, row.id);
    console.error("[upload] R2 write failed", error instanceof Error ? error.message : error);
    throw new ApiError("internal_error", "The file could not be stored. Please try again.");
  }

  let checksum: string | null = null;
  if (file.size <= CHECKSUM_LIMIT_BYTES) {
    try {
      checksum = await sha256Base64(await file.text());
    } catch {
      checksum = null;
    }
  }

  await run(ctx.env.DB, `UPDATE files SET storage_key = ?, checksum = ?, updated_at = ? WHERE id = ?`, key, checksum, nowIso(), row.id);
  const stored = await findFile(ctx.env, user.id, row.id);

  await record(ctx.env, {
    action: "file.uploaded",
    user,
    resourceType: "file",
    resourceId: stored.id,
    ctx,
    details: { name: stored.name, size: stored.size, mimeType: stored.mime_type },
    usage: { uploads: 1, bytes_uploaded: stored.size },
  });

  return created({ file: toFileDto(stored) });
}

export async function update(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const file = await findFile(ctx.env, user.id, ctx.params.id);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  let updated = file;

  if (typeof input.name === "string" && input.name.trim() && input.name.trim() !== file.name) {
    updated = await renameFile(ctx.env, user, updated, input.name);
    await record(ctx.env, { action: "file.renamed", user, resourceType: "file", resourceId: file.id, ctx, details: { from: file.name, to: updated.name } });
  }

  if ("parentId" in input && (input.parentId ?? null) !== updated.parent_id) {
    updated = await moveFile(ctx.env, user, updated, (input.parentId as string | null) ?? null);
    await record(ctx.env, { action: "file.moved", user, resourceType: "file", resourceId: file.id, ctx, details: { to: updated.path } });
  }

  const starred = optionalBool(input, "starred") ?? optionalBool(input, "isStarred");
  if (starred !== undefined && Boolean(updated.starred) !== starred) {
    await run(ctx.env.DB, `UPDATE files SET starred = ?, updated_at = ? WHERE id = ?`, starred ? 1 : 0, nowIso(), file.id);
    updated = await findFile(ctx.env, user.id, file.id);
    await record(ctx.env, { action: "file.starred", user, resourceType: "file", resourceId: file.id, ctx, details: { starred } });
  }

  if (input.permission !== undefined) {
    // Reserved for future collaborative editing; reject quietly rather than pretend.
    throw badRequest("Per-file permissions are managed through shares.");
  }

  return json({ file: toFileDto(updated) });
}

export async function remove(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const file = await findFile(ctx.env, user.id, ctx.params.id);
  const permanent = queryBool(ctx.url, "permanent");

  if (permanent) {
    if (!file.trashed_at) {
      throw badRequest("Move the item to the trash before deleting it permanently.");
    }
    const summary = await purgeFile(ctx.env, user, file);
    await record(ctx.env, {
      action: "file.deleted",
      user,
      resourceType: "file",
      resourceId: file.id,
      ctx,
      details: { name: file.name, rows: summary.rows, bytes: summary.bytes },
      usage: { deletes: 1 },
    });
    return json({ ok: true, permanent: true, items: summary.rows, removed: summary.objects });
  }

  const summary = await trashFile(ctx.env, user, file);
  await record(ctx.env, {
    action: "file.trashed",
    user,
    resourceType: "file",
    resourceId: file.id,
    ctx,
    details: { name: file.name, files: summary.files, folders: summary.folders },
  });
  return json({ ok: true, permanent: false, ...summary });
}

export async function bulk(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(input.action ?? "");
  const ids = (optionalArray(input, "ids", 200) ?? []).map(String);
  if (ids.length === 0) throw badRequest("Select at least one item.");

  const placeholders = ids.map(() => "?").join(",");
  const rows = await all<FileRow>(ctx.env.DB, `SELECT * FROM files WHERE user_id = ? AND id IN (${placeholders})`, user.id, ...ids);
  if (rows.length === 0) throw notFound("None of those items exist.");

  let affected = 0;
  switch (action) {
    case "trash":
      for (const row of rows) {
        if (row.trashed_at) continue;
        await trashFile(ctx.env, user, row);
        affected += 1;
      }
      break;
    case "restore":
      for (const row of rows) {
        if (!row.trashed_at) continue;
        await restoreFile(ctx.env, user, row);
        affected += 1;
      }
      break;
    case "delete":
      for (const row of rows) {
        if (!row.trashed_at) await trashFile(ctx.env, user, row);
        const fresh = await findFile(ctx.env, user.id, row.id);
        await purgeFile(ctx.env, user, fresh);
        affected += 1;
      }
      break;
    case "star":
    case "unstar": {
      const value = action === "star" ? 1 : 0;
      for (const row of rows) {
        await run(ctx.env.DB, `UPDATE files SET starred = ?, updated_at = ? WHERE id = ?`, value, nowIso(), row.id);
        affected += 1;
      }
      break;
    }
    case "move": {
      const parentId = (input.parentId as string | null) ?? null;
      for (const row of rows) {
        await moveFile(ctx.env, user, row, parentId);
        affected += 1;
      }
      break;
    }
    default:
      throw badRequest("Unsupported bulk action. Use trash, restore, delete, star, unstar or move.");
  }

  await record(ctx.env, {
    action: `file.bulk_${action}`,
    user,
    resourceType: "file",
    ctx,
    details: { requested: ids.length, affected },
  });

  return json({ ok: true, affected });
}

export async function emptyTrashRoute(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const summary = await emptyTrash(ctx.env, user);
  await record(ctx.env, { action: "file.trash_emptied", user, ctx, details: { ...summary } });
  return json({ ok: true, removed: summary.rows, bytes: summary.bytes });
}

/** Re-exported so the developer API imports one implementation. */
export { asFile };
