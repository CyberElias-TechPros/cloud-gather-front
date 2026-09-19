/**
 * API keys (manage them while signed in) and the developer API (`/api/v1/*`).
 *
 * Keys are shown once, stored as SHA-256 hashes, scoped to `read`, `write` and
 * `share`, rate limited per key and revocable instantly — the properties the
 * developer documentation promises.
 */

import {
  API_KEY_PREFIX,
  apiKeyScopes,
  currentUser,
  generateApiKey,
  requireScope,
} from "../lib/auth";
import { sha256Hex } from "../lib/crypto";
import { all, first, newId, nowIso, parseJson, run } from "../lib/db";
import { ApiError, badRequest, json, notFound, payloadTooLarge, unauthorized, type Ctx } from "../lib/http";
import type { Next } from "../lib/router";
import { record, recordUsage } from "../lib/events";
import { rateLimitForApiKey } from "../lib/ratelimit";
import { getSettings, numericSetting } from "../lib/settings";
import { optionalArray, optionalInt, optionalString, queryBool, queryInt, queryValue, requireString } from "../lib/validate";
import {
  asFile,
  assertUploadAllowed,
  createFile,
  findFile,
  listFiles,
  moveFile,
  purgeFile,
  renameFile,
  storageKeyFor,
  streamStoredFile,
  toFileDto,
  trashFile,
  usedBytes,
} from "../lib/files";
import { toShareDto } from "./shares";
import type { ApiKeyRow, AuthUser, ShareRow } from "../types";

const VALID_SCOPES = ["read", "write", "share"] as const;

function normaliseScopes(input: unknown): string[] {
  if (!Array.isArray(input)) return ["read"];
  const scopes = input.map(String).filter((scope) => (VALID_SCOPES as readonly string[]).includes(scope));
  return scopes.length > 0 ? [...new Set(scopes)] : ["read"];
}

function toKeyDto(row: ApiKeyRow) {
  const expired = Boolean(row.expires_at && new Date(row.expires_at).getTime() < Date.now());
  return {
    id: row.id,
    name: row.name,
    prefix: row.key_prefix,
    permissions: parseJson<string[]>(row.permissions, ["read"]),
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    requestCount: row.request_count,
    createdAt: row.created_at,
    status: row.revoked_at ? "revoked" : expired ? "expired" : "active",
  };
}

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

export async function list(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const rows = await all<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`, user.id);
  return json({ keys: rows.map(toKeyDto) });
}

export async function create(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const settings = await getSettings(ctx.env);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = requireString(input, "name", { label: "Key name", max: 80 });
  const permissions = normaliseScopes(optionalArray(input, "permissions", VALID_SCOPES.length));
  const expiresInDays = optionalInt(input, "expiresInDays", { min: 1, max: 1095, label: "Expiry" }) ?? null;

  const active = await first<{ count: number }>(
    ctx.env.DB,
    `SELECT COUNT(*) AS count FROM api_keys WHERE user_id = ? AND revoked_at IS NULL`,
    user.id,
  );
  const limit = numericSetting(settings, "max_api_keys_per_user", 25);
  if ((active?.count ?? 0) >= limit) {
    throw new ApiError("conflict", `You already have ${limit} active keys. Revoke one before creating another.`);
  }

  const { secret, prefix } = generateApiKey();
  const id = newId("key");

  await run(
    ctx.env.DB,
    `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, permissions, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    name,
    await sha256Hex(secret),
    prefix,
    JSON.stringify(permissions),
    expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null,
    nowIso(),
  );

  await record(ctx.env, { action: "api_key.created", user, resourceType: "api_key", resourceId: id, ctx, details: { name, permissions } });

  const row = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE id = ?`, id);
  return json(
    {
      key: toKeyDto(row as ApiKeyRow),
      secret,
      warning: "Copy this key now — it is stored hashed and cannot be shown again.",
    },
    { status: 201 },
  );
}

export async function update(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const key = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!key || key.revoked_at) throw notFound("That key no longer exists.");

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = optionalString(input, "name", { max: 80 });
  const permissions = input.permissions ? normaliseScopes(optionalArray(input, "permissions", VALID_SCOPES.length)) : undefined;

  await run(
    ctx.env.DB,
    `UPDATE api_keys SET name = COALESCE(?, name), permissions = COALESCE(?, permissions) WHERE id = ?`,
    name ?? null,
    permissions ? JSON.stringify(permissions) : null,
    key.id,
  );

  const updated = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE id = ?`, key.id);
  return json({ key: toKeyDto(updated as ApiKeyRow) });
}

export async function rotate(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const key = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!key || key.revoked_at) throw notFound("That key no longer exists.");

  const { secret, prefix } = generateApiKey();
  await run(
    ctx.env.DB,
    `UPDATE api_keys SET key_hash = ?, key_prefix = ?, last_used_at = NULL WHERE id = ?`,
    await sha256Hex(secret),
    prefix,
    key.id,
  );

  await record(ctx.env, { action: "api_key.rotated", user, resourceType: "api_key", resourceId: key.id, ctx });

  const updated = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE id = ?`, key.id);
  return json({ key: toKeyDto(updated as ApiKeyRow), secret, warning: "The previous secret stopped working immediately." });
}

export async function revoke(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const key = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!key) throw notFound("That key no longer exists.");
  if (key.revoked_at) return json({ ok: true, alreadyRevoked: true });

  await run(ctx.env.DB, `UPDATE api_keys SET revoked_at = ? WHERE id = ?`, nowIso(), key.id);
  await record(ctx.env, { action: "api_key.revoked", user, resourceType: "api_key", resourceId: key.id, ctx, details: { name: key.name } });
  return json({ ok: true, alreadyRevoked: false });
}

// ---------------------------------------------------------------------------
// Developer API authentication
// ---------------------------------------------------------------------------

/**
 * Authenticates `/api/v1/*` from the `x-api-key` header (or a Bearer token),
 * applies the per-key rate limit and records the call.
 */
export async function withApiKey(ctx: Ctx, next: Next): Promise<Response> {
  const header = ctx.req.headers.get("x-api-key") ?? ctx.req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const token = header.trim();
  if (!token) {
    throw unauthorized("Provide your key in the x-api-key header.");
  }
  if (!token.startsWith(API_KEY_PREFIX)) {
    throw unauthorized("That API key is not valid.");
  }

  const keyHash = await sha256Hex(token);
  const key = await first<ApiKeyRow>(ctx.env.DB, `SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`, keyHash);
  if (!key) throw unauthorized("That API key is not valid.");
  if (key.expires_at && new Date(key.expires_at).getTime() < Date.now()) throw unauthorized("That API key has expired.");

  const user = await first<import("../types").UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, key.user_id);
  if (!user || user.status !== "active") throw unauthorized("The account for that key is not active.");

  const settings = await getSettings(ctx.env);
  const limit = await rateLimitForApiKey(ctx.env, key.id, numericSetting(settings, "api_rate_limit_per_minute", 120));
  if (!limit.allowed) {
    throw new ApiError("rate_limited", `Rate limit reached (${limit.limit} requests per minute for this key).`, {
      limit: limit.limit,
      retryAfter: Math.max(1, Math.ceil((new Date(limit.resetAt).getTime() - Date.now()) / 1000)),
    }, { "retry-after": String(Math.max(1, Math.ceil((new Date(limit.resetAt).getTime() - Date.now()) / 1000))) });
  }

  ctx.state.auth = { user, apiKey: key } satisfies AuthUser;
  ctx.state.apiKey = key;

  const response = await next();

  // Usage accounting is fire-and-forget so it cannot slow the response down.
  ctx.waitUntil(
    (async () => {
      await run(ctx.env.DB, `UPDATE api_keys SET last_used_at = ?, request_count = request_count + 1 WHERE id = ?`, nowIso(), key.id);
      await recordUsage(ctx.env, user.id, { api_calls: 1 });
    })(),
  );

  const headers = new Headers(response.headers);
  headers.set("x-ratelimit-limit", String(limit.limit));
  headers.set("x-ratelimit-remaining", String(limit.remaining));
  headers.set("x-ratelimit-reset", limit.resetAt);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function apiAuth(ctx: Ctx): AuthUser {
  const auth = ctx.state.auth as AuthUser | undefined;
  if (!auth?.apiKey) throw unauthorized("Provide your key in the x-api-key header.");
  return auth;
}

// ---------------------------------------------------------------------------
// /api/v1 endpoints
// ---------------------------------------------------------------------------

export async function me(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  return json({
    id: auth.user.id,
    email: auth.user.email,
    displayName: auth.user.display_name,
    scopes: apiKeyScopes(auth.apiKey as ApiKeyRow),
    keyName: auth.apiKey?.name,
    storageQuotaBytes: auth.user.storage_quota_bytes,
    usedBytes: await usedBytes(ctx.env, auth.user.id),
    authMethod: "api-key",
  });
}

export async function files(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "read");

  const url = ctx.url;
  const folderParam = url.searchParams.get("folderId");
  const result = await listFiles(ctx.env, auth.user.id, {
    folderId: folderParam === "root" || folderParam === "" ? null : folderParam ?? null,
    explicitFolder: folderParam !== null,
    search: queryValue(url, "search"),
    kind: queryValue(url, "kind"),
    starred: queryBool(url, "starred"),
    trashed: queryBool(url, "trashed"),
    sort: (queryValue(url, "sort") as "name" | "date" | "size" | "type") ?? "name",
    direction: (queryValue(url, "direction") as "asc" | "desc") ?? "asc",
    limit: queryInt(url, "limit", { fallback: 100, min: 1, max: 500 }),
    offset: queryInt(url, "offset", { fallback: 0, min: 0 }),
  });

  return json({
    files: result.files.map(toFileDto),
    total: result.total,
    limit: queryInt(url, "limit", { fallback: 100, min: 1, max: 500 }),
    offset: queryInt(url, "offset", { fallback: 0, min: 0 }),
  });
}

export async function fileDetail(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "read");
  const file = await findFile(ctx.env, auth.user.id, ctx.params.id);
  return json({ file: toFileDto(file) });
}

export async function fileContent(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "read");
  const file = await findFile(ctx.env, auth.user.id, ctx.params.id);
  if (file.is_folder) throw badRequest("Folders have no content endpoint. List the folder instead.");
  if (!file.storage_key) throw new ApiError("conflict", "This file lives in a connected drive and has not been imported.");

  const rangeHeader = ctx.req.headers.get("range");
  const range = rangeHeader ? parseByteRange(rangeHeader, file.size) : null;
  const response = await streamStoredFile(ctx.env, file, { range: range ?? undefined, disposition: "attachment" });
  ctx.waitUntil(recordUsage(ctx.env, auth.user.id, { downloads: 1, bytes_downloaded: file.size }));
  return response;
}

export async function createFolder(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "write");
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = requireString(input, "name", { label: "Folder name", max: 200 });
  const folder = await createFile(ctx.env, auth.user, { name, parentId: (input.parentId as string | null) ?? null, isFolder: true });
  await record(ctx.env, { action: "file.folder_created", user: auth.user, resourceType: "folder", resourceId: folder.id, ctx, details: { via: "api" } });
  return json({ folder: toFileDto(folder) }, { status: 201 });
}

export async function uploadFile(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "write");

  const settings = await getSettings(ctx.env);
  const maxFileSizeBytes = numericSetting(settings, "max_file_size_mb", 100) * 1024 * 1024;
  const allowedExtensions = String(settings.allowed_file_types ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  let file: File | null = null;
  let parentId: string | null = null;

  if ((ctx.req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await ctx.req.formData().catch(() => null);
    if (!form) throw badRequest("The upload could not be read.");
    file = asFile(form.get("file"));
    const parent = form.get("parentId");
    parentId = typeof parent === "string" && parent ? parent : null;
  } else {
    const headerName = ctx.req.headers.get("x-file-name");
    if (!headerName) throw badRequest("Send multipart/form-data, or pass the filename in the x-file-name header.");
    let name = headerName;
    try {
      name = decodeURIComponent(headerName);
    } catch {
      name = headerName;
    }
    const buffer = await ctx.req.arrayBuffer();
    if (buffer.byteLength > maxFileSizeBytes) throw payloadTooLarge(`Files are limited to ${Math.round(maxFileSizeBytes / 1_048_576)} MB.`);
    file = new File([buffer], name, { type: ctx.req.headers.get("content-type") ?? "application/octet-stream" });
  }

  if (!file) throw badRequest("No file was included in the request.");
  assertUploadAllowed({ name: file.name, size: file.size, type: file.type }, { maxFileSizeBytes, allowedExtensions });

  const used = await usedBytes(ctx.env, auth.user.id);
  if (used + file.size > auth.user.storage_quota_bytes) {
    throw new ApiError("quota_exceeded", "This upload would exceed the storage allowance for the account.");
  }

  const row = await createFile(ctx.env, auth.user, {
    name: file.name,
    parentId,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  });

  const key = storageKeyFor(auth.user.id, row.id);
  try {
    await ctx.env.FILES.put(key, file, {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { userId: auth.user.id, fileId: row.id },
    });
  } catch (error) {
    await run(ctx.env.DB, `DELETE FROM files WHERE id = ?`, row.id);
    console.error("[api] R2 write failed", error instanceof Error ? error.message : error);
    throw new ApiError("internal_error", "The file could not be stored.");
  }

  await run(ctx.env.DB, `UPDATE files SET storage_key = ? WHERE id = ?`, key, row.id);
  const stored = await findFile(ctx.env, auth.user.id, row.id);
  await record(ctx.env, { action: "file.uploaded", user: auth.user, resourceType: "file", resourceId: stored.id, ctx, details: { via: "api", name: stored.name }, usage: { uploads: 1, bytes_uploaded: stored.size } });

  return json({ file: toFileDto(stored) }, { status: 201 });
}

export async function updateFile(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "write");
  const file = await findFile(ctx.env, auth.user.id, ctx.params.id);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  let updated = file;
  const name = optionalString(input, "name", { max: 200 });
  if (name && name !== file.name) updated = await renameFile(ctx.env, auth.user, updated, name);
  if ("parentId" in input && (input.parentId ?? null) !== updated.parent_id) {
    updated = await moveFile(ctx.env, auth.user, updated, (input.parentId as string | null) ?? null);
  }
  if (typeof input.starred === "boolean" && Boolean(updated.starred) !== input.starred) {
    await run(ctx.env.DB, `UPDATE files SET starred = ? WHERE id = ?`, input.starred ? 1 : 0, file.id);
    updated = await findFile(ctx.env, auth.user.id, file.id);
  }

  await record(ctx.env, { action: "file.updated", user: auth.user, resourceType: "file", resourceId: file.id, ctx, details: { via: "api" } });
  return json({ file: toFileDto(updated) });
}

export async function deleteFile(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "write");
  const file = await findFile(ctx.env, auth.user.id, ctx.params.id);
  const permanent = queryBool(ctx.url, "permanent");

  if (permanent) {
    if (!file.trashed_at) throw badRequest("Move the item to the trash before deleting it permanently.");
    const summary = await purgeFile(ctx.env, auth.user, file);
    await record(ctx.env, { action: "file.deleted", user: auth.user, resourceType: "file", resourceId: file.id, ctx, details: { via: "api" } });
    return json({ ok: true, permanent: true, items: summary.rows });
  }

  const summary = await trashFile(ctx.env, auth.user, file);
  await record(ctx.env, { action: "file.trashed", user: auth.user, resourceType: "file", resourceId: file.id, ctx, details: { via: "api" } });
  return json({ ok: true, permanent: false, ...summary });
}

export async function shares(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "share");
  const rows = await all<ShareRow & { file_name: string; file_size: number; is_folder: number }>(
    ctx.env.DB,
    `SELECT s.*, f.name AS file_name, f.size AS file_size, f.is_folder
       FROM shares s JOIN files f ON f.id = s.file_id
      WHERE s.owner_id = ? AND s.revoked_at IS NULL ORDER BY s.created_at DESC LIMIT 200`,
    auth.user.id,
  );
  return json({ shares: rows.map((row) => toShareDto(row, ctx.env.APP_URL ?? "")) });
}

export async function stats(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "read");
  const used = await usedBytes(ctx.env, auth.user.id);
  const counts = await first<{ files: number; folders: number; trashed: number }>(
    ctx.env.DB,
    `SELECT
       SUM(CASE WHEN is_folder = 0 AND trashed_at IS NULL THEN 1 ELSE 0 END) AS files,
       SUM(CASE WHEN is_folder = 1 AND trashed_at IS NULL THEN 1 ELSE 0 END) AS folders,
       SUM(CASE WHEN trashed_at IS NOT NULL THEN 1 ELSE 0 END) AS trashed
     FROM files WHERE user_id = ?`,
    auth.user.id,
  );
  return json({
    summary: {
      usedBytes: used,
      quotaBytes: auth.user.storage_quota_bytes,
      percentUsed: auth.user.storage_quota_bytes ? (used / auth.user.storage_quota_bytes) * 100 : 0,
      fileCount: counts?.files ?? 0,
      folderCount: counts?.folders ?? 0,
      trashCount: counts?.trashed ?? 0,
    },
  });
}

export async function providers(ctx: Ctx): Promise<Response> {
  const auth = apiAuth(ctx);
  requireScope(auth, "read");
  const rows = await all<import("../types").ProviderRow>(
    ctx.env.DB,
    `SELECT id, provider_name, display_name, status, account_email, total_space, used_space, priority, last_synced_at, created_at
       FROM providers WHERE user_id = ? ORDER BY priority ASC`,
    auth.user.id,
  );
  return json({
    providers: rows.map((row) => ({
      id: row.id,
      providerName: row.provider_name,
      displayName: row.display_name,
      status: row.status,
      accountEmail: row.account_email,
      totalSpace: row.total_space,
      usedSpace: row.used_space,
      priority: row.priority,
      lastSyncedAt: row.last_synced_at,
    })),
  });
}

/** Local range parser so `/api/v1` mirrors the browser API exactly. */
function parseByteRange(value: string, size: number): { offset: number; length: number } | null {
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
  return { offset: start, length: Math.min(end, size - 1) - start + 1 };
}
