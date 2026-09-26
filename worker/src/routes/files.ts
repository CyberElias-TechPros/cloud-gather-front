/** Files, folders, trash, versions, search and storage analytics. */
import { Router } from "../core/router";
import type { Env } from "../env";
import { requireUser } from "../core/context";
import { all, count, first, orderBy, pageParams, paged, run } from "../core/db";
import {
  badRequest,
  conflict,
  contentDisposition,
  forbidden,
  json,
  noContent,
  notFound,
  parseRange,
  readJson,
} from "../core/http";
import { audit } from "../core/audit";
import { getEntitlements } from "../core/entitlements";
import { dispatch } from "../core/webhooks";
import { fileCategory, id, likeEscape, now, toInt } from "../core/util";
import { requireArray, requireEnum, requireFileName, optionalString } from "../core/validate";
import {
  assertNameAvailable,
  assertNotDescendant,
  descendantIds,
  getFile,
  getFolder,
  managedKey,
  publicFile,
  purgeItems,
  repathDescendants,
  restoreItem,
  snapshotVersion,
  touchFile,
  trashItem,
  uniqueName,
  type FileRow,
} from "./fileHelpers";
import { loadProviderRow, openConnection, requireAdapter } from "../providers";

export const fileRoutes = new Router();

const SORTABLE = { name: "filename COLLATE NOCASE", date: "updated_at", size: "size", created: "created_at", accessed: "last_accessed_at" };

/* ------------------------------------------------------------ listing */

fileRoutes.get("/api/files", async (ctx) => {
  const user = requireUser(ctx);
  const params = pageParams(ctx.url, 100, 500);
  const search = ctx.url.searchParams.get("search")?.trim();
  const parent = ctx.url.searchParams.get("parent");
  const filter = ctx.url.searchParams.get("filter"); // starred | shared | folders | recent
  const category = ctx.url.searchParams.get("category");
  const providerId = ctx.url.searchParams.get("provider");

  const where: string[] = ["user_id = ?", "deleted_at IS NULL"];
  const args: unknown[] = [user.id];

  if (search) {
    where.push("filename LIKE ? ESCAPE '\\'");
    args.push(`%${likeEscape(search)}%`);
  } else if (ctx.url.searchParams.get("all") !== "1" && filter !== "starred" && filter !== "shared") {
    if (parent) {
      where.push("parent_folder_id = ?");
      args.push(parent);
    } else {
      where.push("parent_folder_id IS NULL");
    }
  }
  if (filter === "starred") where.push("is_starred = 1");
  if (filter === "shared") where.push("is_shared = 1");
  if (filter === "folders") where.push("is_folder = 1");
  if (category) {
    where.push("COALESCE(category, '') = ?");
    args.push(category);
  }
  if (providerId) {
    where.push("provider_id = ?");
    args.push(providerId);
  }

  const clause = where.join(" AND ");
  const order = orderBy(ctx.url.searchParams.get("sort"), SORTABLE, "name", ctx.url.searchParams.get("direction"));
  const rows = await all<FileRow>(
    ctx.env,
    `SELECT * FROM files WHERE ${clause} ORDER BY is_folder DESC, ${order} LIMIT ? OFFSET ?`,
    ...args,
    params.limit,
    params.offset,
  );
  const total = await count(ctx.env, `SELECT count(*) AS value FROM files WHERE ${clause}`, ...args);
  return json({ files: rows.map(publicFile), ...paged(rows.map(publicFile), total, params) });
}, { auth: true, scope: "read", summary: "List files and folders" });

fileRoutes.get("/api/files/tree", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all<{ id: string; filename: string; path: string; parent_folder_id: string | null }>(
    ctx.env,
    "SELECT id, filename, path, parent_folder_id FROM files WHERE user_id = ? AND is_folder = 1 AND deleted_at IS NULL ORDER BY path LIMIT 2000",
    user.id,
  );
  return json({ folders: rows });
}, { auth: true, scope: "read", summary: "Folder tree for move/copy pickers" });

fileRoutes.get("/api/files/recents", async (ctx) => {
  const user = requireUser(ctx);
  const limit = Math.min(Math.max(toInt(ctx.url.searchParams.get("limit"), 30), 1), 100);
  const rows = await all<FileRow>(
    ctx.env,
    `SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL AND is_folder = 0
      ORDER BY COALESCE(last_accessed_at, updated_at) DESC LIMIT ?`,
    user.id,
    limit,
  );
  return json({ files: rows.map(publicFile) });
}, { auth: true, scope: "read" });

fileRoutes.get("/api/files/stats", async (ctx) => {
  const user = requireUser(ctx);
  const entitlements = await getEntitlements(ctx.env, user);
  const byCategory = await all<{ category: string; bytes: number; items: number }>(
    ctx.env,
    `SELECT COALESCE(category, 'other') AS category, SUM(size) AS bytes, COUNT(*) AS items
       FROM files WHERE user_id = ? AND deleted_at IS NULL AND is_folder = 0
      GROUP BY COALESCE(category, 'other') ORDER BY bytes DESC`,
    user.id,
  );
  const byProvider = await all<{ provider_id: string | null; provider_name: string | null; bytes: number; items: number }>(
    ctx.env,
    `SELECT f.provider_id, p.provider_name, SUM(f.size) AS bytes, COUNT(*) AS items
       FROM files f LEFT JOIN storage_providers p ON p.id = f.provider_id
      WHERE f.user_id = ? AND f.deleted_at IS NULL AND f.is_folder = 0
      GROUP BY f.provider_id, p.provider_name`,
    user.id,
  );
  const largest = await all<FileRow>(
    ctx.env,
    "SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL AND is_folder = 0 ORDER BY size DESC LIMIT 10",
    user.id,
  );
  const providers = await all(
    ctx.env,
    "SELECT id, provider_name, provider_user_email, status, total_space, used_space, last_sync_at FROM storage_providers WHERE user_id = ? ORDER BY priority",
    user.id,
  );
  return json({
    usage: entitlements.usage,
    limits: entitlements.limits,
    plan: { id: entitlements.plan.id, name: entitlements.plan.name },
    storage_percent: entitlements.storagePercent,
    by_category: byCategory,
    by_provider: byProvider,
    largest_files: largest.map(publicFile),
    providers,
  });
}, { auth: true, scope: "read", summary: "Storage analytics" });

/* --------------------------------------------------------- unified search */

fileRoutes.get("/api/search", async (ctx) => {
  const user = requireUser(ctx);
  const query = (ctx.url.searchParams.get("q") || "").trim();
  if (!query) return json({ files: [], provider_files: [], total: 0 });
  const like = `%${likeEscape(query)}%`;
  const limit = Math.min(Math.max(toInt(ctx.url.searchParams.get("limit"), 40), 1), 100);

  const files = await all<FileRow>(
    ctx.env,
    `SELECT * FROM files WHERE user_id = ? AND deleted_at IS NULL
       AND (filename LIKE ? ESCAPE '\\' OR COALESCE(description,'') LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')
     ORDER BY is_folder DESC, updated_at DESC LIMIT ?`,
    user.id,
    like,
    like,
    like,
    limit,
  );

  const providerFiles = await all<{
    id: string; provider_id: string; remote_id: string; name: string; path: string | null; size: number;
    mime_type: string | null; is_folder: number; web_url: string | null; modified_at: string | null; provider_name: string;
  }>(
    ctx.env,
    `SELECT pf.*, sp.provider_name FROM provider_files pf
       JOIN storage_providers sp ON sp.id = pf.provider_id
      WHERE pf.user_id = ? AND pf.name LIKE ? ESCAPE '\\'
      ORDER BY pf.is_folder DESC, pf.modified_at DESC LIMIT ?`,
    user.id,
    like,
    limit,
  );

  return json({
    query,
    files: files.map(publicFile),
    provider_files: providerFiles.map((row) => ({
      id: row.id,
      provider_id: row.provider_id,
      provider_name: row.provider_name,
      remote_id: row.remote_id,
      name: row.name,
      path: row.path,
      size: Number(row.size || 0),
      mime_type: row.mime_type,
      is_folder: Boolean(row.is_folder),
      web_url: row.web_url,
      modified_at: row.modified_at,
    })),
    total: files.length + providerFiles.length,
  });
}, { auth: true, scope: "read", summary: "Search across CloudGather and connected providers" });

fileRoutes.get("/api/saved-searches", async (ctx) => {
  const user = requireUser(ctx);
  return json({ searches: await all(ctx.env, "SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC", user.id) });
}, { auth: true, scope: "read" });

fileRoutes.post("/api/saved-searches", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ name: string; query: string; filters?: Record<string, unknown> }>(ctx.request);
  const rowId = id();
  await run(
    ctx.env,
    "INSERT INTO saved_searches(id, user_id, name, query, filters) VALUES(?, ?, ?, ?, ?)",
    rowId,
    user.id,
    requireFileName(payload.name, "Name"),
    String(payload.query || "").slice(0, 200),
    JSON.stringify(payload.filters || {}),
  );
  return json({ search: await first(ctx.env, "SELECT * FROM saved_searches WHERE id = ?", rowId) }, 201);
}, { auth: true, scope: "write" });

fileRoutes.delete("/api/saved-searches/:id", async (ctx) => {
  const user = requireUser(ctx);
  await run(ctx.env, "DELETE FROM saved_searches WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  return noContent();
}, { auth: true, scope: "write" });

/* ------------------------------------------------------------- single */

fileRoutes.get("/api/files/:id", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  const shares = await count(ctx.env, "SELECT count(*) AS value FROM file_shares WHERE file_id = ? AND revoked_at IS NULL", file.id);
  const links = await count(ctx.env, "SELECT count(*) AS value FROM public_links WHERE file_id = ? AND revoked_at IS NULL", file.id);
  const versions = await count(ctx.env, "SELECT count(*) AS value FROM file_versions WHERE file_id = ?", file.id);
  return json({ file: publicFile(file), share_count: shares, link_count: links, version_count: versions });
}, { auth: true, scope: "read" });

fileRoutes.get("/api/files/:id/path", async (ctx) => {
  const user = requireUser(ctx);
  // Works for files and folders alike: a file resolves to its parent chain.
  const item = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  const basePath = item.is_folder ? item.path : item.path.slice(0, item.path.length - item.filename.length - 1);
  const parts = basePath.split("/").filter(Boolean);
  const folders: unknown[] = [];
  let path = "";
  for (const part of parts) {
    path += `/${part}`;
    const row = await first<FileRow>(ctx.env, "SELECT * FROM files WHERE user_id = ? AND path = ? AND is_folder = 1 AND deleted_at IS NULL", user.id, path);
    if (row) folders.push(publicFile(row));
  }
  return json({ folders });
}, { auth: true, scope: "read" });

fileRoutes.post("/api/folders", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ name: string; parent_folder_id?: string | null }>(ctx.request);
  const name = requireFileName(payload.name, "Folder name");
  const parentId = payload.parent_folder_id || null;
  const basePath = parentId ? (await getFolder(ctx.env, user.id, parentId)).path : "";
  await assertNameAvailable(ctx.env, user.id, parentId, name);

  const folderId = id();
  await run(
    ctx.env,
    `INSERT INTO files(id, user_id, filename, path, is_folder, parent_folder_id, storage_kind, category)
     VALUES(?, ?, ?, ?, 1, ?, 'managed', 'folder')`,
    folderId,
    user.id,
    name,
    `${basePath}/${name}`,
    parentId,
  );
  const file = await getFile(ctx.env, user.id, folderId);
  await audit(ctx, { action: "folder.created", resourceType: "file", resourceId: folderId, details: { name } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "folder.created", publicFile(file)));
  return json({ file: publicFile(file) }, 201);
}, { auth: true, scope: "write", verified: true, summary: "Create a folder" });

fileRoutes.patch("/api/files/:id", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id);
  const payload = await readJson<{
    filename?: string;
    is_starred?: boolean;
    description?: string | null;
    tags?: string[];
    parent_folder_id?: string | null;
  }>(ctx.request);

  const updates: string[] = [];
  const args: unknown[] = [];
  let newPath = file.path;
  let filename = file.filename;

  if (payload.filename !== undefined) {
    filename = requireFileName(payload.filename, "Name");
  }
  const movingParent = payload.parent_folder_id !== undefined && (payload.parent_folder_id || null) !== file.parent_folder_id;
  const parentId = movingParent ? payload.parent_folder_id || null : file.parent_folder_id;

  if (movingParent) {
    if (file.is_folder) await assertNotDescendant(ctx.env, user.id, file.id, parentId);
    if (parentId) await getFolder(ctx.env, user.id, parentId);
  }
  if (payload.filename !== undefined || movingParent) {
    await assertNameAvailable(ctx.env, user.id, parentId, filename, file.id);
    const basePath = parentId ? (await getFolder(ctx.env, user.id, parentId)).path : "";
    newPath = `${basePath}/${filename}`;
    updates.push("filename = ?", "path = ?", "parent_folder_id = ?");
    args.push(filename, newPath, parentId);
  }
  if (payload.is_starred !== undefined) {
    updates.push("is_starred = ?");
    args.push(payload.is_starred ? 1 : 0);
  }
  if (payload.description !== undefined) {
    updates.push("description = ?");
    args.push(optionalString(payload.description, "Description", 2000));
  }
  if (payload.tags !== undefined) {
    const tags = requireArray<string>(payload.tags, "Tags", 25).map((tag) => String(tag).trim().slice(0, 40)).filter(Boolean);
    updates.push("tags = ?");
    args.push(JSON.stringify(tags));
  }
  if (!updates.length) return json({ file: publicFile(file) });

  updates.push("updated_at = ?");
  args.push(now(), file.id, user.id);
  await run(ctx.env, `UPDATE files SET ${updates.join(", ")} WHERE id = ? AND user_id = ?`, ...args);

  if (file.is_folder && newPath !== file.path) await repathDescendants(ctx.env, user.id, file.path, newPath);

  const updated = await getFile(ctx.env, user.id, file.id);
  await audit(ctx, {
    action: movingParent ? "file.moved" : payload.filename !== undefined ? "file.renamed" : "file.updated",
    resourceType: "file",
    resourceId: file.id,
    details: { from: file.filename, to: updated.filename },
  });
  ctx.waitUntil(dispatch(ctx.env, user.id, movingParent ? "file.moved" : "file.updated", publicFile(updated)));
  return json({ file: publicFile(updated) });
}, { auth: true, scope: "write", summary: "Rename, move, star or tag an item" });

fileRoutes.post("/api/files/:id/copy", async (ctx) => {
  const user = requireUser(ctx);
  const source = await getFile(ctx.env, user.id, ctx.params.id);
  const payload = await readJson<{ parent_folder_id?: string | null; name?: string }>(ctx.request).catch(() => ({}) as { parent_folder_id?: string | null; name?: string });
  const targetParent = payload.parent_folder_id !== undefined ? payload.parent_folder_id : source.parent_folder_id;
  if (source.is_folder) await assertNotDescendant(ctx.env, user.id, source.id, targetParent || null);

  const entitlements = await getEntitlements(ctx.env, user);
  if (!source.is_folder && entitlements.limits.storageBytes > 0) {
    if (entitlements.usage.storageBytes + Number(source.size) > entitlements.limits.storageBytes) {
      throw forbidden("Copying this file would exceed your storage quota.", "quota_exceeded");
    }
  }

  const copyId = await copyTree(ctx.env, user.id, source, targetParent || null, payload.name);
  const created = await getFile(ctx.env, user.id, copyId);
  await audit(ctx, { action: "file.copied", resourceType: "file", resourceId: copyId, details: { source: source.id } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "file.created", publicFile(created)));
  return json({ file: publicFile(created) }, 201);
}, { auth: true, scope: "write", verified: true, summary: "Duplicate a file or folder" });

/** Recursively copies a subtree, duplicating R2 objects for managed files. */
async function copyTree(env: Env, userId: string, source: FileRow, parentId: string | null, explicitName?: string): Promise<string> {
  const name = await uniqueName(env, userId, parentId, explicitName || source.filename);
  const basePath = parentId ? (await getFolder(env, userId, parentId)).path : "";
  const newId = id();
  let r2Key: string | null = null;

  if (!source.is_folder && source.r2_key) {
    const object = await env.FILES.get(source.r2_key);
    if (object) {
      r2Key = managedKey(userId, newId, name);
      await env.FILES.put(r2Key, object.body, { httpMetadata: { contentType: source.mime_type || "application/octet-stream" } });
    }
  }

  await run(
    env,
    `INSERT INTO files(id, user_id, filename, path, size, mime_type, is_folder, parent_folder_id, storage_kind, r2_key,
                       provider_id, provider_file_id, category, description, tags)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId,
    userId,
    name,
    `${basePath}/${name}`,
    source.is_folder ? 0 : source.size,
    source.mime_type,
    source.is_folder ? 1 : 0,
    parentId,
    source.storage_kind,
    r2Key,
    source.provider_id,
    source.provider_file_id,
    source.category || fileCategory(source.mime_type, Boolean(source.is_folder)),
    source.description,
    source.tags,
  );

  if (source.is_folder) {
    const children = await all<FileRow>(
      env,
      "SELECT * FROM files WHERE user_id = ? AND parent_folder_id = ? AND deleted_at IS NULL LIMIT 500",
      userId,
      source.id,
    );
    for (const child of children) await copyTree(env, userId, child, newId);
  }
  return newId;
}

fileRoutes.delete("/api/files/:id", async (ctx) => {
  const user = requireUser(ctx);
  const permanent = ctx.url.searchParams.get("permanent") === "1";
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  const entitlements = await getEntitlements(ctx.env, user);

  if (permanent) {
    await purgeItems(ctx.env, user.id, [file.id]);
    await audit(ctx, { action: "file.purged", resourceType: "file", resourceId: file.id, details: { name: file.filename }, severity: "warning" });
  } else {
    if (file.deleted_at) throw conflict("This item is already in the trash.", "already_trashed");
    await trashItem(ctx.env, user.id, file, entitlements.limits.trashRetentionDays);
    await audit(ctx, { action: "file.trashed", resourceType: "file", resourceId: file.id, details: { name: file.filename } });
  }
  ctx.waitUntil(dispatch(ctx.env, user.id, "file.deleted", { id: file.id, filename: file.filename, permanent }));
  return noContent();
}, { auth: true, scope: "write", summary: "Move an item to trash (or purge it)" });

fileRoutes.post("/api/files/bulk", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ ids: string[]; action: string; parent_folder_id?: string | null }>(ctx.request);
  const ids = requireArray<string>(payload.ids, "ids", 200);
  const action = requireEnum(payload.action, ["trash", "restore", "purge", "star", "unstar", "move"] as const, "action");
  const entitlements = await getEntitlements(ctx.env, user);

  let affected = 0;
  const errors: { id: string; message: string }[] = [];

  for (const fileId of ids) {
    try {
      const file = await getFile(ctx.env, user.id, fileId, { includeTrashed: true });
      switch (action) {
        case "trash":
          await trashItem(ctx.env, user.id, file, entitlements.limits.trashRetentionDays);
          break;
        case "restore":
          await restoreItem(ctx.env, user.id, file);
          break;
        case "purge":
          await purgeItems(ctx.env, user.id, [file.id]);
          break;
        case "star":
        case "unstar":
          await run(ctx.env, "UPDATE files SET is_starred = ?, updated_at = ? WHERE id = ? AND user_id = ?", action === "star" ? 1 : 0, now(), file.id, user.id);
          break;
        case "move": {
          const parentId = payload.parent_folder_id || null;
          if (file.is_folder) await assertNotDescendant(ctx.env, user.id, file.id, parentId);
          const name = await uniqueName(ctx.env, user.id, parentId, file.filename);
          const basePath = parentId ? (await getFolder(ctx.env, user.id, parentId)).path : "";
          const newPath = `${basePath}/${name}`;
          await run(
            ctx.env,
            "UPDATE files SET parent_folder_id = ?, filename = ?, path = ?, updated_at = ? WHERE id = ? AND user_id = ?",
            parentId,
            name,
            newPath,
            now(),
            file.id,
            user.id,
          );
          if (file.is_folder) await repathDescendants(ctx.env, user.id, file.path, newPath);
          break;
        }
      }
      affected += 1;
    } catch (error) {
      errors.push({ id: fileId, message: error instanceof Error ? error.message : "Failed." });
    }
  }

  await audit(ctx, { action: `files.bulk_${action}`, details: { requested: ids.length, affected, failed: errors.length } });
  return json({ ok: errors.length === 0, affected, errors });
}, { auth: true, scope: "write", summary: "Bulk trash/restore/move/star" });

/* -------------------------------------------------------------- trash */

fileRoutes.get("/api/trash", async (ctx) => {
  const user = requireUser(ctx);
  const params = pageParams(ctx.url, 100, 200);
  const rows = await all<FileRow>(
    ctx.env,
    "SELECT * FROM files WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT ? OFFSET ?",
    user.id,
    params.limit,
    params.offset,
  );
  const total = await count(ctx.env, "SELECT count(*) AS value FROM files WHERE user_id = ? AND deleted_at IS NOT NULL", user.id);
  const bytes = await count(ctx.env, "SELECT COALESCE(SUM(size),0) AS value FROM files WHERE user_id = ? AND deleted_at IS NOT NULL", user.id);
  return json({ ...paged(rows.map(publicFile), total, params), files: rows.map(publicFile), bytes });
}, { auth: true, scope: "read", summary: "List trashed items" });

fileRoutes.post("/api/trash/:id/restore", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  if (!file.deleted_at) throw conflict("This item is not in the trash.", "not_trashed");
  const restored = await restoreItem(ctx.env, user.id, file);
  await audit(ctx, { action: "file.restored", resourceType: "file", resourceId: file.id });
  ctx.waitUntil(dispatch(ctx.env, user.id, "file.restored", publicFile(restored)));
  return json({ file: publicFile(restored) });
}, { auth: true, scope: "write" });

fileRoutes.post("/api/trash/empty", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all<{ id: string }>(
    ctx.env,
    "SELECT id FROM files WHERE user_id = ? AND deleted_at IS NOT NULL AND parent_folder_id IS NULL",
    user.id,
  );
  const orphans = await all<{ id: string }>(
    ctx.env,
    `SELECT f.id FROM files f WHERE f.user_id = ? AND f.deleted_at IS NOT NULL
       AND (f.parent_folder_id IS NULL OR NOT EXISTS (SELECT 1 FROM files p WHERE p.id = f.parent_folder_id AND p.deleted_at IS NOT NULL))`,
    user.id,
  );
  const ids = [...new Set([...rows, ...orphans].map((row) => row.id))];
  const removed = await purgeItems(ctx.env, user.id, ids);
  await audit(ctx, { action: "trash.emptied", details: { removed }, severity: "warning" });
  return json({ ok: true, removed });
}, { auth: true, scope: "write", summary: "Permanently empty the trash" });

/* ----------------------------------------------------------- versions */

fileRoutes.get("/api/files/:id/versions", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  const versions = await all(
    ctx.env,
    "SELECT id, version, size, mime_type, note, created_at FROM file_versions WHERE file_id = ? ORDER BY version DESC",
    file.id,
  );
  return json({ current_version: file.version, versions });
}, { auth: true, scope: "read" });

fileRoutes.post("/api/files/:id/versions/:versionId/restore", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id);
  const version = await first<{ id: string; r2_key: string; size: number; mime_type: string | null; version: number }>(
    ctx.env,
    "SELECT id, r2_key, size, mime_type, version FROM file_versions WHERE id = ? AND file_id = ? AND user_id = ?",
    ctx.params.versionId,
    file.id,
    user.id,
  );
  if (!version) throw notFound("That version no longer exists.", "version_not_found");
  const entitlements = await getEntitlements(ctx.env, user);
  await snapshotVersion(ctx.env, file, entitlements.limits.versionHistory, "Replaced by version restore");

  const object = await ctx.env.FILES.get(version.r2_key);
  if (!object) throw notFound("The stored content for that version is missing.", "version_content_missing");
  const targetKey = file.r2_key || managedKey(user.id, file.id, file.filename);
  await ctx.env.FILES.put(targetKey, object.body, { httpMetadata: { contentType: version.mime_type || "application/octet-stream" } });
  await run(
    ctx.env,
    "UPDATE files SET r2_key = ?, size = ?, mime_type = ?, version = version + 1, updated_at = ? WHERE id = ?",
    targetKey,
    version.size,
    version.mime_type,
    now(),
    file.id,
  );
  await audit(ctx, { action: "file.version_restored", resourceType: "file", resourceId: file.id, details: { version: version.version } });
  return json({ file: publicFile(await getFile(ctx.env, user.id, file.id)) });
}, { auth: true, scope: "write" });

/* ----------------------------------------------------------- download */

fileRoutes.get("/api/files/:id/download", async (ctx) => {
  const user = requireUser(ctx);
  const inline = ctx.url.searchParams.get("inline") === "1";
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  if (file.is_folder) throw badRequest("Folders cannot be downloaded directly. Download individual files.", "folder_download");

  touchFile(ctx, file.id);
  ctx.waitUntil(run(ctx.env, "UPDATE files SET download_count = download_count + 1 WHERE id = ?", file.id).then(() => undefined, () => undefined));

  if (file.storage_kind === "provider" && file.provider_id) {
    const row = await loadProviderRow(ctx.env, user.id, file.provider_id);
    if (!row) throw notFound("The provider for this file is no longer connected.", "provider_missing");
    const adapter = requireAdapter(row.provider_name);
    const connection = await openConnection(ctx.env, row);
    const response = await adapter.download(connection, file.provider_file_id || file.id);
    const filename = response.headers.get("x-cloudgather-filename") || file.filename;
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") || file.mime_type || "application/octet-stream",
        "content-disposition": contentDisposition(filename, inline),
        "cache-control": "private, max-age=0, must-revalidate",
      },
    });
  }

  if (!file.r2_key) throw notFound("This file has no stored content.", "content_missing");
  const range = parseRange(ctx.request.headers.get("range"), Number(file.size || 0));
  const object = await ctx.env.FILES.get(file.r2_key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!object) throw notFound("The stored object could not be found.", "content_missing");

  const headers: Record<string, string> = {
    "content-type": file.mime_type || "application/octet-stream",
    "content-disposition": contentDisposition(file.filename, inline),
    etag: object.httpEtag,
    "accept-ranges": "bytes",
    "cache-control": "private, max-age=0, must-revalidate",
  };
  if (range) {
    headers["content-range"] = `bytes ${range.start}-${range.end}/${file.size}`;
    headers["content-length"] = String(range.end - range.start + 1);
    return new Response(object.body, { status: 206, headers });
  }
  headers["content-length"] = String(file.size);
  return new Response(object.body, { headers });
}, { auth: true, scope: "read", summary: "Download file content" });

fileRoutes.get("/api/files/:id/preview", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id);
  const previewable = /^(image|text|audio|video)\//.test(file.mime_type || "") || file.mime_type === "application/pdf";
  if (!previewable) throw badRequest("This file type cannot be previewed in the browser.", "not_previewable");
  const target = new URL(ctx.request.url);
  target.pathname = target.pathname.replace(/\/preview$/, "/download");
  target.searchParams.set("inline", "1");
  return Response.redirect(target.toString(), 302);
}, { auth: true, scope: "read" });
