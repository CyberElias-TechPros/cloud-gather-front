/** Uploads: single-request form uploads and resumable multipart transfers. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, first, run } from "../core/db";
import { badRequest, conflict, json, noContent, notFound, readJson, tooLarge } from "../core/http";
import { audit } from "../core/audit";
import { assertUploadAllowed, getEntitlements } from "../core/entitlements";
import { dispatch } from "../core/webhooks";
import { notify } from "../core/notify";
import { templates } from "../core/email";
import { fileCategory, formatBytes, guessMimeType, id, inMinutes, now, parseJson, toInt } from "../core/util";
import { requireFileName } from "../core/validate";
import { getFile, getFolder, managedKey, publicFile, snapshotVersion, uniqueName } from "./fileHelpers";

export const uploadRoutes = new Router();

/** 8 MiB parts balance request count against Worker memory limits. */
const PART_SIZE = 8 * 1024 * 1024;

async function warnIfNearQuota(ctx: Parameters<typeof audit>[0], userId: string) {
  const user = ctx.user!;
  const entitlements = await getEntitlements(ctx.env, user);
  if (entitlements.limits.storageBytes <= 0) return;
  if (entitlements.storagePercent < 85) return;
  const template = templates.storageWarning(
    ctx.env,
    entitlements.storagePercent,
    formatBytes(entitlements.usage.storageBytes),
    formatBytes(entitlements.limits.storageBytes),
  );
  await notify(ctx.env, {
    userId,
    type: entitlements.storagePercent >= 100 ? "storage.full" : "storage.warning",
    title: `Storage is ${entitlements.storagePercent}% full`,
    body: `${formatBytes(entitlements.usage.storageBytes)} of ${formatBytes(entitlements.limits.storageBytes)} used.`,
    link: "/storage",
    email: template,
  });
}

/* --------------------------------------------------- single-request upload */

uploadRoutes.post("/api/files/upload", async (ctx) => {
  const user = requireUser(ctx);
  const contentType = ctx.request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) throw badRequest("Send the file as multipart/form-data.", "invalid_content_type");

  const form = await ctx.request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) throw badRequest("Choose a non-empty file to upload.", "empty_file");

  const parentId = String(form.get("parent_folder_id") || "") || null;
  const replaceFileId = String(form.get("replace_file_id") || "") || null;
  const entitlements = await getEntitlements(ctx.env, user);
  assertUploadAllowed(entitlements, file.size);

  if (parentId) await getFolder(ctx.env, user.id, parentId);
  const mime = file.type || guessMimeType(file.name);

  if (replaceFileId) {
    const existing = await getFile(ctx.env, user.id, replaceFileId);
    if (existing.is_folder) throw badRequest("You cannot replace a folder with a file.", "invalid_target");
    await snapshotVersion(ctx.env, existing, entitlements.limits.versionHistory, "Replaced by upload");
    const key = existing.r2_key || managedKey(user.id, existing.id, existing.filename);
    await ctx.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: mime } });
    await run(
      ctx.env,
      "UPDATE files SET size = ?, mime_type = ?, r2_key = ?, version = version + 1, category = ?, updated_at = ?, last_accessed_at = ? WHERE id = ?",
      file.size,
      mime,
      key,
      fileCategory(mime),
      now(),
      now(),
      existing.id,
    );
    const updated = await getFile(ctx.env, user.id, existing.id);
    await audit(ctx, { action: "file.version_uploaded", resourceType: "file", resourceId: existing.id, details: { size: file.size } });
    ctx.waitUntil(dispatch(ctx.env, user.id, "file.updated", publicFile(updated)));
    return json({ file: publicFile(updated) }, 201);
  }

  const filename = await uniqueName(ctx.env, user.id, parentId, requireFileName(file.name, "File name"));
  const basePath = parentId ? (await getFolder(ctx.env, user.id, parentId)).path : "";
  const fileId = id();
  const key = managedKey(user.id, fileId, filename);

  try {
    await ctx.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: mime } });
    await run(
      ctx.env,
      `INSERT INTO files(id, user_id, filename, path, size, mime_type, parent_folder_id, storage_kind, r2_key, category, last_accessed_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, 'managed', ?, ?, ?)`,
      fileId,
      user.id,
      filename,
      `${basePath}/${filename}`,
      file.size,
      mime,
      parentId,
      key,
      fileCategory(mime),
      now(),
    );
  } catch (error) {
    await ctx.env.FILES.delete(key).catch(() => undefined);
    throw error;
  }

  const created = await getFile(ctx.env, user.id, fileId);
  await audit(ctx, { action: "file.uploaded", resourceType: "file", resourceId: fileId, details: { size: file.size, name: filename } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "file.created", publicFile(created)));
  ctx.waitUntil(warnIfNearQuota(ctx, user.id));
  return json({ file: publicFile(created) }, 201);
}, { auth: true, scope: "write", verified: true, summary: "Upload a file" });

/* ------------------------------------------------------ resumable uploads */

uploadRoutes.post("/api/uploads", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ filename: string; size: number; mime_type?: string; parent_folder_id?: string | null; replace_file_id?: string | null }>(ctx.request);
  const size = toInt(payload.size, 0);
  if (size <= 0) throw badRequest("A positive file size is required.", "invalid_size");

  const entitlements = await getEntitlements(ctx.env, user);
  assertUploadAllowed(entitlements, size);

  const parentId = payload.parent_folder_id || null;
  if (parentId) await getFolder(ctx.env, user.id, parentId);
  if (payload.replace_file_id) await getFile(ctx.env, user.id, payload.replace_file_id);

  const filename = payload.replace_file_id
    ? requireFileName(payload.filename, "File name")
    : await uniqueName(ctx.env, user.id, parentId, requireFileName(payload.filename, "File name"));
  const sessionId = id();
  const fileId = payload.replace_file_id || id();
  const key = managedKey(user.id, fileId, filename);
  const mime = payload.mime_type || guessMimeType(filename);

  let multipartId: string | null = null;
  if (size > PART_SIZE) {
    const upload = await ctx.env.FILES.createMultipartUpload(key, { httpMetadata: { contentType: mime } });
    multipartId = upload.uploadId;
  }

  await run(
    ctx.env,
    `INSERT INTO upload_sessions(id, user_id, filename, parent_folder_id, size, mime_type, r2_key, multipart_id, file_id, replace_file_id, expires_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sessionId,
    user.id,
    filename,
    parentId,
    size,
    mime,
    key,
    multipartId,
    fileId,
    payload.replace_file_id || null,
    inMinutes(60 * 24),
  );

  return json({
    upload: {
      id: sessionId,
      part_size: PART_SIZE,
      parts: Math.max(1, Math.ceil(size / PART_SIZE)),
      multipart: Boolean(multipartId),
      filename,
      expires_at: inMinutes(60 * 24),
    },
  }, 201);
}, { auth: true, scope: "write", verified: true, summary: "Start a resumable upload" });

uploadRoutes.get("/api/uploads", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(
    ctx.env,
    "SELECT id, filename, size, bytes_received, status, created_at, expires_at FROM upload_sessions WHERE user_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 50",
    user.id,
  );
  return json({ uploads: rows });
}, { auth: true, scope: "read" });

uploadRoutes.put("/api/uploads/:id/parts/:part", async (ctx) => {
  const user = requireUser(ctx);
  const session = await first<{
    id: string; r2_key: string; multipart_id: string | null; parts: string; bytes_received: number; status: string; mime_type: string | null;
  }>(ctx.env, "SELECT * FROM upload_sessions WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!session) throw notFound("Upload session not found.", "upload_not_found");
  if (session.status !== "open") throw conflict("This upload session is already finished.", "upload_closed");

  const partNumber = toInt(ctx.params.part, 0);
  if (partNumber < 1 || partNumber > 10_000) throw badRequest("Invalid part number.", "invalid_part");

  const body = await ctx.request.arrayBuffer();
  if (!body.byteLength) throw badRequest("Part body is empty.", "empty_part");
  if (body.byteLength > PART_SIZE * 2) throw tooLarge("Part exceeds the maximum part size.");

  const parts = parseJson<{ partNumber: number; etag: string }[]>(session.parts, []);

  if (session.multipart_id) {
    const upload = ctx.env.FILES.resumeMultipartUpload(session.r2_key, session.multipart_id);
    const uploaded = await upload.uploadPart(partNumber, body);
    const next = [...parts.filter((part) => part.partNumber !== partNumber), { partNumber, etag: uploaded.etag }];
    await run(
      ctx.env,
      "UPDATE upload_sessions SET parts = ?, bytes_received = ? WHERE id = ?",
      JSON.stringify(next),
      Number(session.bytes_received || 0) + body.byteLength,
      session.id,
    );
  } else {
    await ctx.env.FILES.put(session.r2_key, body, { httpMetadata: { contentType: session.mime_type || "application/octet-stream" } });
    await run(ctx.env, "UPDATE upload_sessions SET bytes_received = ? WHERE id = ?", body.byteLength, session.id);
  }

  return json({ ok: true, part: partNumber, received: body.byteLength });
}, { auth: true, scope: "write", summary: "Upload one part of a resumable upload" });

uploadRoutes.post("/api/uploads/:id/complete", async (ctx) => {
  const user = requireUser(ctx);
  const session = await first<{
    id: string; filename: string; parent_folder_id: string | null; size: number; mime_type: string | null;
    r2_key: string; multipart_id: string | null; parts: string; file_id: string; replace_file_id: string | null; status: string;
  }>(ctx.env, "SELECT * FROM upload_sessions WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!session) throw notFound("Upload session not found.", "upload_not_found");
  if (session.status !== "open") throw conflict("This upload has already been completed.", "upload_closed");

  if (session.multipart_id) {
    const parts = parseJson<{ partNumber: number; etag: string }[]>(session.parts, []).sort((a, b) => a.partNumber - b.partNumber);
    if (!parts.length) throw badRequest("No parts were uploaded.", "no_parts");
    const upload = ctx.env.FILES.resumeMultipartUpload(session.r2_key, session.multipart_id);
    await upload.complete(parts);
  }

  const head = await ctx.env.FILES.head(session.r2_key);
  const actualSize = head?.size ?? session.size;
  const entitlements = await getEntitlements(ctx.env, user);

  if (session.replace_file_id) {
    const existing = await getFile(ctx.env, user.id, session.replace_file_id);
    await snapshotVersion(ctx.env, existing, entitlements.limits.versionHistory, "Replaced by resumable upload");
    await run(
      ctx.env,
      "UPDATE files SET size = ?, mime_type = ?, r2_key = ?, version = version + 1, updated_at = ?, last_accessed_at = ? WHERE id = ?",
      actualSize,
      session.mime_type,
      session.r2_key,
      now(),
      now(),
      existing.id,
    );
  } else {
    const basePath = session.parent_folder_id ? (await getFolder(ctx.env, user.id, session.parent_folder_id)).path : "";
    await run(
      ctx.env,
      `INSERT INTO files(id, user_id, filename, path, size, mime_type, parent_folder_id, storage_kind, r2_key, category, last_accessed_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, 'managed', ?, ?, ?)`,
      session.file_id,
      user.id,
      session.filename,
      `${basePath}/${session.filename}`,
      actualSize,
      session.mime_type,
      session.parent_folder_id,
      session.r2_key,
      fileCategory(session.mime_type),
      now(),
    );
  }

  await run(ctx.env, "UPDATE upload_sessions SET status = 'completed' WHERE id = ?", session.id);
  const file = await getFile(ctx.env, user.id, session.replace_file_id || session.file_id);
  await audit(ctx, { action: "file.uploaded", resourceType: "file", resourceId: file.id, details: { size: actualSize, resumable: true } });
  ctx.waitUntil(dispatch(ctx.env, user.id, session.replace_file_id ? "file.updated" : "file.created", publicFile(file)));
  ctx.waitUntil(warnIfNearQuota(ctx, user.id));
  return json({ file: publicFile(file) }, 201);
}, { auth: true, scope: "write" });

uploadRoutes.delete("/api/uploads/:id", async (ctx) => {
  const user = requireUser(ctx);
  const session = await first<{ id: string; r2_key: string; multipart_id: string | null }>(
    ctx.env,
    "SELECT id, r2_key, multipart_id FROM upload_sessions WHERE id = ? AND user_id = ?",
    ctx.params.id,
    user.id,
  );
  if (!session) throw notFound("Upload session not found.", "upload_not_found");
  if (session.multipart_id) {
    await ctx.env.FILES.resumeMultipartUpload(session.r2_key, session.multipart_id).abort().catch(() => undefined);
  } else {
    await ctx.env.FILES.delete(session.r2_key).catch(() => undefined);
  }
  await run(ctx.env, "UPDATE upload_sessions SET status = 'aborted' WHERE id = ?", session.id);
  return noContent();
}, { auth: true, scope: "write" });
