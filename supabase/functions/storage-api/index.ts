/**
 * storage-api — the public CloudGather REST API (v1).
 *
 * Authentication uses personal API keys via the `x-api-key` header. Keys are
 * verified by hashing the presented value (SHA-256) and looking up the hash —
 * the database never stores plaintext keys.
 *
 * All queries run with the service-role client and are scoped explicitly to
 * the key owner's user_id. This is intentional: key callers have no JWT, so
 * RLS would otherwise (correctly) block every query.
 *
 * Endpoints:
 *   GET    /api/v1/files                  list files (?folder=&sort=&direction=)
 *   GET    /api/v1/files/:id              file metadata
 *   GET    /api/v1/files/:id/download     download content
 *   POST   /api/v1/files/folder           { folderName, parentFolderId? }
 *   POST   /api/v1/files/upload           multipart: file, parentFolderId?
 *   POST   /api/v1/files/:id/share        { email, permissionLevel, expiresAt? }
 *   DELETE /api/v1/files/:id
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  preflight,
  json,
  errorResponse,
  sha256Hex,
  normalizePermissions,
  rateLimit,
} from "../_shared/api.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const RATE_LIMIT_PER_MINUTE = 100;

const VALID_SORTS = new Set(["name", "date", "size"]);

Deno.serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  if (!SERVICE_ROLE_KEY) {
    return errorResponse("Server misconfiguration", 500);
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/storage-api/, "").replace(/\/$/, "") || "/";
  const apiKey = req.headers.get("x-api-key") ?? "";

  if (!apiKey) return errorResponse("API key is required", 401);

  // ── Verify the key ───────────────────────────────────────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const keyHash = await sha256Hex(apiKey.trim());
  const { data: keyRow, error: keyError } = await admin
    .from("api_keys")
    .select("id, user_id, permissions, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyError || !keyRow) return errorResponse("Invalid API key", 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) <= new Date()) {
    return errorResponse("API key has expired", 401);
  }

  const permissions = normalizePermissions(keyRow.permissions);
  const userId = keyRow.user_id as string;

  // ── Rate limiting (per key, fixed 1-minute window) ──────────────────────
  const limit = rateLimit(keyRow.id, RATE_LIMIT_PER_MINUTE, 60_000);
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Retry shortly." }), {
      status: 429,
      headers: {
        ...cors(),
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))),
      },
    });
  }

  // Best-effort last-used stamp (fire and forget).
  admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id)
    .then(() => undefined, () => undefined);

  const requiresPermission = (permission: string): Response | null =>
    permissions.includes(permission)
      ? null
      : errorResponse(`This key does not include the "${permission}" permission`, 403);

  try {
    // ── List files ─────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/api/v1/files") {
      const denied = requiresPermission("read");
      if (denied) return denied;

      const folder = url.searchParams.get("folder");
      const sortParam = url.searchParams.get("sort") ?? "date";
      const sortBy = VALID_SORTS.has(sortParam) ? sortParam : "date";
      const direction = url.searchParams.get("direction") === "asc" ? "asc" : "desc";
      const limitParam = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200), 1), 1000);

      let query = admin.from("files").select("*").eq("user_id", userId).limit(limitParam);
      query = folder ? query.eq("parent_folder_id", folder) : query.is("parent_folder_id", null);
      const column = sortBy === "name" ? "filename" : sortBy === "date" ? "updated_at" : "size";
      query = query.order(column, { ascending: direction === "asc" }).order("filename", { ascending: true });

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return json({ files: data ?? [] });
    }

    // ── File metadata ──────────────────────────────────────────────────────
    const metadataMatch = path.match(/^\/api\/v1\/files\/([^/]+)$/);
    if (req.method === "GET" && metadataMatch) {
      const denied = requiresPermission("read");
      if (denied) return denied;

      const { data, error } = await admin
        .from("files")
        .select("*")
        .eq("id", metadataMatch[1])
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return errorResponse("File not found", 404);
      return json({ file: data });
    }

    // ── Download ───────────────────────────────────────────────────────────
    const downloadMatch = path.match(/^\/api\/v1\/files\/([^/]+)\/download$/);
    if (req.method === "GET" && downloadMatch) {
      const denied = requiresPermission("read");
      if (denied) return denied;

      const fileId = downloadMatch[1];
      const { data: file, error } = await admin
        .from("files")
        .select("provider_id, provider_file_id, filename, mime_type, is_folder")
        .eq("id", fileId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error || !file) return errorResponse("File not found", 404);
      if (file.is_folder) return errorResponse("Folders cannot be downloaded", 400);
      if (!file.provider_file_id) return errorResponse("File has no stored content", 404);

      const { data: blob, error: storageError } = await admin.storage
        .from("user_uploads")
        .download(file.provider_file_id);
      if (storageError || !blob) return errorResponse("Could not read file content", 404);

      return new Response(blob, {
        status: 200,
        headers: {
          ...cors(),
          "Content-Type": file.mime_type || "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
        },
      });
    }

    // ── Create folder ──────────────────────────────────────────────────────
    if (req.method === "POST" && path === "/api/v1/files/folder") {
      const denied = requiresPermission("write");
      if (denied) return denied;

      const body = await req.json().catch(() => ({}));
      const folderName = typeof body.folderName === "string" ? body.folderName.trim() : "";
      const parentFolderId = typeof body.parentFolderId === "string" && body.parentFolderId ? body.parentFolderId : null;

      if (!folderName) return errorResponse("folderName is required", 400);
      if (folderName.length > 255) return errorResponse("folderName is too long", 400);
      if (/[/\\]/.test(folderName)) return errorResponse("folderName cannot contain slashes", 400);

      let computedPath = `/${folderName}`;
      if (parentFolderId) {
        const { data: parent } = await admin
          .from("files")
          .select("path")
          .eq("id", parentFolderId)
          .eq("user_id", userId)
          .eq("is_folder", true)
          .maybeSingle();
        if (!parent) return errorResponse("Parent folder not found", 404);
        computedPath = `${parent.path}/${folderName}`;
      }

      const { data, error } = await admin
        .from("files")
        .insert({
          filename: folderName,
          path: computedPath,
          is_folder: true,
          parent_folder_id: parentFolderId,
          size: 0,
          user_id: userId,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") return errorResponse("An item with this name already exists", 409);
        throw new Error(error.message);
      }
      return json({ folder: data }, 201);
    }

    // ── Upload ─────────────────────────────────────────────────────────────
    if (req.method === "POST" && path === "/api/v1/files/upload") {
      const denied = requiresPermission("write");
      if (denied) return denied;

      const contentType = req.headers.get("content-type") ?? "";
      if (!contentType.includes("multipart/form-data")) {
        return errorResponse("Send the upload as multipart/form-data", 400);
      }

      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return errorResponse("A 'file' field is required", 400);
      if (file.size === 0) return errorResponse("File is empty", 400);
      if (file.size > MAX_UPLOAD_BYTES) return errorResponse("File exceeds the 100 MB limit", 413);

      const parentFolderIdRaw = form.get("parentFolderId");
      const parentFolderId = typeof parentFolderIdRaw === "string" && parentFolderIdRaw ? parentFolderIdRaw : null;

      let computedPath = `/${file.name}`;
      if (parentFolderId) {
        const { data: parent } = await admin
          .from("files")
          .select("path")
          .eq("id", parentFolderId)
          .eq("user_id", userId)
          .eq("is_folder", true)
          .maybeSingle();
        if (!parent) return errorResponse("Parent folder not found", 404);
        computedPath = `${parent.path}/${file.name}`;
      }

      const storagePath = `${userId}/${Date.now()}_${file.name.replace(/[/\\]/g, "_")}`;
      const { error: uploadError } = await admin.storage
        .from("user_uploads")
        .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
      if (uploadError) return errorResponse(`Upload failed: ${uploadError.message}`, 500);

      const { data, error } = await admin
        .from("files")
        .insert({
          filename: file.name,
          size: file.size,
          mime_type: file.type || null,
          path: computedPath,
          parent_folder_id: parentFolderId,
          provider_file_id: storagePath,
          user_id: userId,
        })
        .select("*")
        .single();

      if (error) {
        await admin.storage.from("user_uploads").remove([storagePath]);
        if (error.code === "23505") return errorResponse("An item with this name already exists", 409);
        throw new Error(error.message);
      }
      return json({ file: data }, 201);
    }

    // ── Share ──────────────────────────────────────────────────────────────
    const shareMatch = path.match(/^\/api\/v1\/files\/([^/]+)\/share$/);
    if (req.method === "POST" && shareMatch) {
      const denied = requiresPermission("share");
      if (denied) return denied;

      const body = await req.json().catch(() => ({}));
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const permissionLevel = body.permissionLevel === "edit" ? "edit" : "view";
      const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorResponse("A valid email is required", 400);
      if (expiresAt && Number.isNaN(Date.parse(expiresAt))) return errorResponse("expiresAt must be a valid date", 400);
      if (expiresAt && new Date(expiresAt) <= new Date()) return errorResponse("expiresAt must be in the future", 400);

      const { data: file } = await admin
        .from("files")
        .select("id")
        .eq("id", shareMatch[1])
        .eq("user_id", userId)
        .maybeSingle();
      if (!file) return errorResponse("File not found", 404);

      const { data, error } = await admin
        .from("file_shares")
        .insert({
          file_id: file.id,
          owner_id: userId,
          shared_with_email: email,
          permission_level: permissionLevel,
          expires_at: expiresAt,
        })
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") return errorResponse("Already shared with this email", 409);
        throw new Error(error.message);
      }

      await admin.from("files").update({ is_shared: true }).eq("id", file.id);
      return json({ share: data }, 201);
    }

    // ── Delete ─────────────────────────────────────────────────────────────
    const deleteMatch = path.match(/^\/api\/v1\/files\/([^/]+)$/);
    if (req.method === "DELETE" && deleteMatch) {
      const denied = requiresPermission("write");
      if (denied) return denied;

      const fileId = deleteMatch[1];
      const { data: file } = await admin
        .from("files")
        .select("id, path, is_folder, provider_file_id")
        .eq("id", fileId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!file) return errorResponse("File not found", 404);

      if (file.is_folder) {
        const { data: descendants } = await admin
          .from("files")
          .select("id, provider_file_id, is_folder")
          .like("path", `${file.path}/%`)
          .eq("user_id", userId);
        const storagePaths = (descendants ?? [])
          .map((d) => (d.is_folder ? null : d.provider_file_id))
          .filter((p): p is string => Boolean(p));
        if (storagePaths.length > 0) await admin.storage.from("user_uploads").remove(storagePaths);
        const ids = (descendants ?? []).map((d) => d.id);
        if (ids.length > 0) await admin.from("files").delete().in("id", ids).eq("user_id", userId);
      } else if (file.provider_file_id) {
        await admin.storage.from("user_uploads").remove([file.provider_file_id]);
      }

      const { error } = await admin.from("files").delete().eq("id", fileId).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return json({ success: true });
    }

    return errorResponse("Not found", 404);
  } catch (error) {
    console.error("[storage-api]", (error as Error).message);
    return errorResponse("The request could not be completed", 500);
  }
});

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  };
}
