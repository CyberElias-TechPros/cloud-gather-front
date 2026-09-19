/**
 * Public developer API (`/api/v1/*`) authenticated with a personal API key.
 *
 * These routes are thin wrappers over the same domain logic the web app uses, so
 * the documented contract and the product can never drift apart. Scopes are
 * enforced per route with `requireScope`.
 */

import type { RouteContext } from "../types";
import { Router } from "../lib/router";
import { badRequest, json, notFound, readJson, validationFailed } from "../lib/http";
import { v } from "../lib/validate";
import { requireAuth, requireScope, rateLimit } from "../middleware";
import { recordAudit, recordUsage } from "../lib/events";
import {
  assertNameFree,
  assertUploadAllowed,
  buildPath,
  classifyKind,
  effectiveQuota,
  findFile,
  findFolder,
  newFileId,
  newFolderId,
  sanitizeName,
  storageKeyFor,
  storageSummary,
  toFileDto,
  type FileRow,
} from "../lib/files";
import { loadSettings } from "../lib/settings";
import { randomId, randomToken } from "../lib/crypto";
import { asFile, mimeFromName, parseRange } from "./files";

export function developerRoutes(router: Router): void {
  const auth = [requireAuth, rateLimit("developer-api", "settings.api")] as const;

  router.get("/api/v1/me", ...auth, async (ctx) => {
    return json({
      user: {
        id: ctx.user!.id,
        email: ctx.user!.email,
        displayName: ctx.user!.displayName,
        role: ctx.user!.role,
      },
      key: ctx.user!.apiKeyId
        ? { id: ctx.user!.apiKeyId, permissions: ctx.user!.apiKeyPermissions ?? [] }
        : { id: null, permissions: ["session"] },
      authMethod: ctx.user!.authMethod,
    });
  });

  router.get("/api/v1/files", ...auth, requireScope("read"), async (ctx) => {
    const folderId = ctx.url.searchParams.get("folder");
    const search = ctx.url.searchParams.get("search");
    const limit = Math.min(200, Math.max(1, Number(ctx.url.searchParams.get("limit") ?? 100) || 100));
    const offset = Math.max(0, Number(ctx.url.searchParams.get("offset") ?? 0) || 0);
    const sortBy = ctx.url.searchParams.get("sort") ?? "name";
    const direction = ctx.url.searchParams.get("direction") === "desc" ? "desc" : "asc";
    const trashed = ctx.url.searchParams.get("trashed") === "true";

    const conditions = ["user_id = ?1"];
    const binds: unknown[] = [ctx.user!.id];
    if (folderId && folderId !== "root") {
      await findFolder(ctx.env, ctx.user!.id, folderId);
      conditions.push(`parent_folder_id = ?${binds.push(folderId) as number}`);
    } else if (!search && !trashed) {
      conditions.push("parent_folder_id IS NULL");
    }
    conditions.push(trashed ? "trashed_at IS NOT NULL" : "trashed_at IS NULL");
    if (search) conditions.push(`lower(name) LIKE ?${binds.push(`%${search.toLowerCase()}%`) as number}`);

    const column = sortBy === "size" ? "size" : sortBy === "date" ? "updated_at" : "lower(name)";
    const rows = await ctx.env.DB.prepare(
      `SELECT * FROM files WHERE ${conditions.join(" AND ")} ORDER BY is_folder DESC, ${column} ${direction.toUpperCase()}
        LIMIT ?${binds.push(limit) as number} OFFSET ?${binds.push(offset) as number}`,
    )
      .bind(...binds)
      .all<FileRow>();

    const totalBinds = binds.slice(0, binds.length - 2);
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS total FROM files WHERE ${conditions.join(" AND ")}`)
      .bind(...totalBinds)
      .first<{ total: number }>();

    return json({ files: (rows.results ?? []).map(toFileDto), total: total?.total ?? 0, limit, offset });
  });

  router.get("/api/v1/files/:id", ...auth, requireScope("read"), async (ctx) => {
    const file = await findFile(ctx.env, ctx.user!.id, ctx.params.id);
    return json({ file: toFileDto(file) });
  });

  router.get("/api/v1/files/:id/download", ...auth, requireScope("read"), async (ctx) => {
    const file = await findFile(ctx.env, ctx.user!.id, ctx.params.id);
    if (file.is_folder === 1) throw badRequest("Folders cannot be downloaded through this endpoint.");
    if (!file.storage_key) throw badRequest("This file is indexed from a connected provider; download it from the provider.");
    const object = await ctx.env.FILES.get(file.storage_key);
    if (!object) throw notFound("The stored file is missing.");
    ctx.waitUntil(recordUsage(ctx.env, ctx.user!.id, { downloads: 1, bytes_downloaded: file.size }));
    return new Response(object.body, {
      headers: {
        "content-type": file.mime_type || "application/octet-stream",
        "content-length": String(file.size),
        "content-disposition": `attachment; filename="${file.name.replace(/"/g, "")}"`,
      },
    });
  });

  // Partial content support for API clients that stream/seek.
  router.get("/api/v1/files/:id/content", ...auth, requireScope("read"), async (ctx) => {
    const file = await findFile(ctx.env, ctx.user!.id, ctx.params.id);
    if (!file.storage_key) throw notFound("This file is not hosted by CloudGather.");
    const range = parseRange(ctx.req.headers.get("range"), file.size);
    const object = await ctx.env.FILES.get(
      file.storage_key,
      range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
    );
    if (!object) throw notFound("The stored file is missing.");
    const headers = new Headers({
      "content-type": file.mime_type || "application/octet-stream",
      "accept-ranges": "bytes",
    });
    if (range) headers.set("content-range", `bytes ${range.start}-${range.end}/${file.size}`);
    return new Response(object.body, { status: range ? 206 : 200, headers });
  });

  router.post("/api/v1/files/folder", ...auth, requireScope("write"), async (ctx) => {
    const parsed = v
      .object({ name: v.string({ min: 1, max: 255 }), parentId: v.string({ max: 64 }).nullable().optional() })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const name = sanitizeName(parsed.value.name);
    const parentId = parsed.value.parentId ?? null;
    const parent = await findFolder(ctx.env, ctx.user!.id, parentId);
    await assertNameFree(ctx.env, ctx.user!.id, parentId, name);

    const id = newFolderId();
    const now = new Date().toISOString();
    await ctx.env.DB.prepare(
      `INSERT INTO files (id, user_id, parent_folder_id, name, path, size, is_folder, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 0, 1, ?6, ?6)`,
    )
      .bind(id, ctx.user!.id, parentId, name, buildPath(parent?.path ?? "/", name), now)
      .run();

    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "api.folder_created", resourceType: "folder", resourceId: id }));
    return json({ folder: toFileDto(await findFile(ctx.env, ctx.user!.id, id)) }, { status: 201 });
  });

  router.post("/api/v1/files/upload", ...auth, requireScope("write"), async (ctx) => {
    const settings = await loadSettings(ctx.env);
    const contentType = ctx.req.headers.get("content-type") ?? "";

    // Two accepted shapes: multipart/form-data (file + parentId) or a raw body
    // with the name supplied via the X-File-Name header.
    if (contentType.includes("multipart/form-data")) {
      const form = await ctx.req.formData();
      const entry = asFile(form.get("file"));
      if (!entry) throw badRequest("Include a `file` field.");
      const parentId = (form.get("parentId") as string | null) || null;
      return uploadEntry(ctx, entry, parentId, settings, false);
    }

    const name = ctx.req.headers.get("x-file-name");
    if (!name) throw badRequest("Send multipart/form-data, or set the X-File-Name header with a raw body.");
    const contentLength = Number(ctx.req.headers.get("content-length") ?? 0);
    if (!contentLength) throw badRequest("A Content-Length header is required for raw uploads.");
    const parentId = ctx.url.searchParams.get("parentId");
    const buffer = await ctx.req.arrayBuffer();
    const blob = {
      name,
      size: buffer.byteLength,
      type: ctx.req.headers.get("content-type") || mimeFromName(name),
      stream: () => new Response(buffer).body as ReadableStream<Uint8Array>,
    };
    return uploadEntry(ctx, blob, parentId, settings, true);
  });

  router.patch("/api/v1/files/:id", ...auth, requireScope("write"), async (ctx) => {
    const parsed = v
      .object({
        name: v.string({ min: 1, max: 255 }).optional(),
        parentId: v.string({ max: 64 }).nullable().optional(),
        isStarred: v.boolean().optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const file = await findFile(ctx.env, ctx.user!.id, ctx.params.id);
    const now = new Date().toISOString();
    if (parsed.value.name) {
      const name = sanitizeName(parsed.value.name);
      await assertNameFree(ctx.env, ctx.user!.id, file.parent_folder_id, name, file.id);
      await ctx.env.DB.prepare("UPDATE files SET name = ?1, path = ?2, updated_at = ?3 WHERE id = ?4")
        .bind(name, buildPath(parentPathOf(file.path), name), now, file.id)
        .run();
    }
    if (parsed.value.isStarred !== undefined) {
      await ctx.env.DB.prepare("UPDATE files SET is_starred = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(parsed.value.isStarred ? 1 : 0, now, file.id)
        .run();
    }
    return json({ file: toFileDto(await findFile(ctx.env, ctx.user!.id, file.id)) });
  });

  router.delete("/api/v1/files/:id", ...auth, requireScope("write"), async (ctx) => {
    const file = await findFile(ctx.env, ctx.user!.id, ctx.params.id);
    const permanent = ctx.url.searchParams.get("permanent") === "true";

    if (!permanent) {
      await ctx.env.DB.prepare("UPDATE files SET trashed_at = ?1, is_starred = 0, updated_at = ?1 WHERE id = ?2")
        .bind(new Date().toISOString(), file.id)
        .run();
      ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "api.file_trashed", resourceType: "file", resourceId: file.id }));
      return json({ ok: true, permanent: false });
    }

    if (file.storage_key) await ctx.env.FILES.delete(file.storage_key);
    await ctx.env.DB.prepare("DELETE FROM files WHERE id = ?1").bind(file.id).run();
    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "api.file_deleted", resourceType: "file", resourceId: file.id }));
    ctx.waitUntil(recordUsage(ctx.env, ctx.user!.id, { deletes: 1 }));
    return json({ ok: true, permanent: true });
  });

  router.post("/api/v1/shares", ...auth, requireScope("share"), async (ctx) => {
    const parsed = v
      .object({
        fileId: v.string({ min: 3, max: 64 }),
        kind: v.literal(["email", "link"] as const).default("link"),
        email: v.email().optional(),
        permission: v.literal(["view", "edit"] as const).default("view"),
        expiresInDays: v.int({ min: 0, max: 365 }).nullable().optional(),
        maxDownloads: v.int({ min: 1, max: 100000 }).nullable().optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    if (parsed.value.kind === "email" && !parsed.value.email) throw validationFailed(["email is required for email shares"]);

    const file = await findFile(ctx.env, ctx.user!.id, parsed.value.fileId);
    const token = randomToken(24);
    const id = `shr_${token.slice(0, 12)}`;
    const expiresAt =
      parsed.value.expiresInDays && parsed.value.expiresInDays > 0
        ? new Date(Date.now() + parsed.value.expiresInDays * 86_400_000).toISOString()
        : null;

    let recipientUserId: string | null = null;
    if (parsed.value.email) {
      const recipient = await ctx.env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?1")
        .bind(parsed.value.email)
        .first<{ id: string }>();
      recipientUserId = recipient?.id ?? null;
    }

    await ctx.env.DB.prepare(
      `INSERT INTO shares (id, file_id, owner_id, kind, recipient_email, recipient_user_id, permission, token, expires_at, max_downloads, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    )
      .bind(
        id,
        file.id,
        ctx.user!.id,
        parsed.value.kind,
        parsed.value.email ?? null,
        recipientUserId,
        parsed.value.permission,
        token,
        expiresAt,
        parsed.value.maxDownloads ?? null,
        new Date().toISOString(),
      )
      .run();

    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "api.share_created", resourceType: "share", resourceId: id }));
    ctx.waitUntil(recordUsage(ctx.env, ctx.user!.id, { shares_created: 1 }));

    return json({ share: { id, fileId: file.id, kind: parsed.value.kind, permission: parsed.value.permission, url: `${ctx.env.APP_URL}/s/${token}`, expiresAt } }, { status: 201 });
  });

  router.get("/api/v1/shares", ...auth, requireScope("read"), async (ctx) => {
    const fileId = ctx.url.searchParams.get("fileId");
    const rows = await ctx.env.DB.prepare(
      `SELECT s.id, s.file_id, s.kind, s.permission, s.token, s.expires_at, s.download_count, s.view_count, s.created_at, f.name AS file_name
         FROM shares s JOIN files f ON f.id = s.file_id
        WHERE s.owner_id = ?1 AND s.revoked_at IS NULL ${fileId ? "AND s.file_id = ?2" : ""}
        ORDER BY s.created_at DESC LIMIT 200`,
    )
      .bind(...(fileId ? [ctx.user!.id, fileId] : [ctx.user!.id]))
      .all<Record<string, unknown>>();

    return json({
      shares: (rows.results ?? []).map((row) => ({
        id: row.id,
        fileId: row.file_id,
        fileName: row.file_name,
        kind: row.kind,
        permission: row.permission,
        url: row.token ? `${ctx.env.APP_URL}/s/${row.token}` : null,
        expiresAt: row.expires_at,
        downloadCount: row.download_count,
        viewCount: row.view_count,
        createdAt: row.created_at,
      })),
    });
  });

  router.delete("/api/v1/shares/:id", ...auth, requireScope("share"), async (ctx) => {
    const result = await ctx.env.DB.prepare("UPDATE shares SET revoked_at = ?1 WHERE id = ?2 AND owner_id = ?3 AND revoked_at IS NULL")
      .bind(new Date().toISOString(), ctx.params.id, ctx.user!.id)
      .run();
    if (!result.meta.changes) throw notFound("That share does not exist.");
    return json({ ok: true });
  });

  router.get("/api/v1/stats", ...auth, requireScope("read"), async (ctx) => {
    const settings = await loadSettings(ctx.env);
    const quota = await effectiveQuota(ctx.env, ctx.user!.id, settings.default_quota_gb);
    const summary = await storageSummary(ctx.env, ctx.user!.id, quota);
    return json({ summary, percentUsed: quota > 0 ? Math.round((summary.usedBytes / quota) * 1000) / 10 : 0 });
  });

  router.get("/api/v1/providers", ...auth, requireScope("read"), async (ctx) => {
    const rows = await ctx.env.DB.prepare(
      "SELECT id, provider_name, auth_type, status, account_email, total_space, used_space, priority FROM providers WHERE user_id = ?1 ORDER BY priority",
    )
      .bind(ctx.user!.id)
      .all();
    return json({ providers: rows.results ?? [] });
  });
}

async function uploadEntry(
  ctx: RouteContext,
  entry: { name: string; size: number; type: string; stream: () => ReadableStream<Uint8Array> },
  parentId: string | null,
  settings: Awaited<ReturnType<typeof loadSettings>>,
  fromRawBody: boolean,
): Promise<Response> {
  const parent = await findFolder(ctx.env, ctx.user!.id, parentId === "root" ? null : parentId);
  const quota = await effectiveQuota(ctx.env, ctx.user!.id, settings.default_quota_gb);
  await assertUploadAllowed(ctx.env, ctx.user!.id, entry.size, entry.type, settings, quota);

  const name = sanitizeName(entry.name || "upload");
  await assertNameFree(ctx.env, ctx.user!.id, parent?.id ?? null, name);

  const id = newFileId();
  const now = new Date().toISOString();
  const path = buildPath(parent?.path ?? "/", name);
  const storageKey = storageKeyFor(ctx.user!.id, id, name);

  await ctx.env.DB.prepare(
    `INSERT INTO files (id, user_id, parent_folder_id, name, path, size, mime_type, is_folder, storage_key, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?9)`,
  )
    .bind(id, ctx.user!.id, parent?.id ?? null, name, path, entry.size, entry.type || mimeFromName(name), storageKey, now)
    .run();

  try {
    await ctx.env.FILES.put(storageKey, entry.stream(), {
      httpMetadata: { contentType: entry.type || mimeFromName(name) },
      customMetadata: { userId: ctx.user!.id, fileId: id, source: fromRawBody ? "api-raw" : "api" },
    });
  } catch (error) {
    await ctx.env.DB.prepare("DELETE FROM files WHERE id = ?1").bind(id).run();
    console.error(JSON.stringify({ level: "error", message: "api upload failed", error: String(error) }));
    throw new Response(JSON.stringify({ error: "Storage write failed" }), { status: 502 });
  }

  ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "api.file_uploaded", resourceType: "file", resourceId: id, details: { name, bytes: entry.size } }));
  ctx.waitUntil(recordUsage(ctx.env, ctx.user!.id, { uploads: 1, bytes_uploaded: entry.size }));

  return json(
    {
      file: toFileDto(await findFile(ctx.env, ctx.user!.id, id)),
      links: {
        self: `/api/v1/files/${id}`,
        download: `/api/v1/files/${id}/download`,
      },
    },
    { status: 201 },
  );
}

function parentPathOf(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx <= 0 ? "/" : path.slice(0, idx);
}

export const __internal = { classifyKind, randomId };
