/**
 * Administrator console: platform totals, user management, system settings,
 * provider credentials, the audit trail, contact messages and blog authoring.
 *
 * Every handler here is mounted behind `requireAdmin`, and sensitive values
 * (OAuth client secrets) are never returned — only whether one is stored.
 */

import { currentUser, setPassword } from "../lib/auth";
import { seal } from "../lib/crypto";
import { all, first, newId, nowIso, parseJson, run, stringifyJson } from "../lib/db";
import { badRequest, created, forbidden, json, notFound, type Ctx } from "../lib/http";
import { record } from "../lib/events";
import { SETTINGS, getSettings, numericSetting, updateSettings } from "../lib/settings";
import { optionalBool, optionalInt, optionalString, queryInt, queryValue, requireString } from "../lib/validate";
import { listProviderConfigs } from "../lib/providers";
import type { UserRow } from "../types";

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function stats(ctx: Ctx): Promise<Response> {
  const [users, files, providers, shares, keys, messages, storage, growth, topUsers, recentUsers] = await Promise.all([
    first<{ total: number; admins: number; suspended: number; verified: number }>(
      ctx.env.DB,
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS admins,
              SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
              SUM(CASE WHEN email_verified = 1 THEN 1 ELSE 0 END) AS verified
         FROM users`,
    ),
    first<{ files: number; folders: number; trashed: number; bytes: number }>(
      ctx.env.DB,
      `SELECT SUM(CASE WHEN is_folder = 0 THEN 1 ELSE 0 END) AS files,
              SUM(CASE WHEN is_folder = 1 AND trashed_at IS NULL THEN 1 ELSE 0 END) AS folders,
              SUM(CASE WHEN trashed_at IS NOT NULL THEN 1 ELSE 0 END) AS trashed,
              COALESCE(SUM(CASE WHEN trashed_at IS NULL AND is_folder = 0 THEN size ELSE 0 END), 0) AS bytes
         FROM files`,
    ),
    first<{ total: number; connected: number }>(
      ctx.env.DB,
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) AS connected FROM providers`,
    ),
    first<{ total: number; active: number; downloads: number }>(
      ctx.env.DB,
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN revoked_at IS NULL AND (expires_at IS NULL OR expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')) THEN 1 ELSE 0 END) AS active,
              COALESCE(SUM(download_count), 0) AS downloads
         FROM shares`,
    ),
    first<{ total: number; active: number }>(
      ctx.env.DB,
      `SELECT COUNT(*) AS total, SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END) AS active FROM api_keys`,
    ),
    first<{ total: number; unread: number }>(
      ctx.env.DB,
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS unread FROM contact_messages`,
    ),
    all<{ provider_name: string; bytes: number; count: number; users: number }>(
      ctx.env.DB,
      `SELECT p.provider_name, COALESCE(SUM(f.size), 0) AS bytes, COUNT(f.id) AS count, COUNT(DISTINCT p.user_id) AS users
         FROM providers p LEFT JOIN files f ON f.provider_id = p.id AND f.trashed_at IS NULL
        GROUP BY p.provider_name ORDER BY bytes DESC`,
    ),
    all<{ day: string; users: number; uploads: number; downloads: number; api_calls: number }>(
      ctx.env.DB,
      `SELECT u.day,
              (SELECT COUNT(*) FROM users WHERE substr(created_at, 1, 10) = u.day) AS users,
              SUM(u.uploads) AS uploads, SUM(u.downloads) AS downloads, SUM(u.api_calls) AS api_calls
         FROM usage_daily u GROUP BY u.day ORDER BY u.day DESC LIMIT 30`,
    ),
    all<Record<string, unknown>>(
      ctx.env.DB,
      `SELECT u.id, u.email, u.display_name, u.role,
              COALESCE(SUM(f.size), 0) AS used_bytes, COUNT(f.id) AS file_count
         FROM users u LEFT JOIN files f ON f.user_id = u.id AND f.trashed_at IS NULL AND f.is_folder = 0
        GROUP BY u.id ORDER BY used_bytes DESC LIMIT 10`,
    ),
    all<Record<string, unknown>>(
      ctx.env.DB,
      `SELECT id, email, display_name, role, status, created_at FROM users ORDER BY created_at DESC LIMIT 8`,
    ),
  ]);

  const week = await first<{ count: number }>(
    ctx.env.DB,
    `SELECT COUNT(*) AS count FROM users WHERE created_at > ?`,
    new Date(Date.now() - 7 * 86_400_000).toISOString(),
  );

  return json({
    totals: {
      users: users?.total ?? 0,
      admins: users?.admins ?? 0,
      suspended: users?.suspended ?? 0,
      verifiedUsers: users?.verified ?? 0,
      newUsersThisWeek: week?.count ?? 0,
      files: files?.files ?? 0,
      folders: files?.folders ?? 0,
      trashed: files?.trashed ?? 0,
      storedBytes: files?.bytes ?? 0,
      providers: providers?.total ?? 0,
      connectedProviders: providers?.connected ?? 0,
      shares: shares?.total ?? 0,
      activeShares: shares?.active ?? 0,
      shareDownloads: shares?.downloads ?? 0,
      apiKeys: keys?.total ?? 0,
      activeApiKeys: keys?.active ?? 0,
      messages: messages?.total ?? 0,
      unreadMessages: messages?.unread ?? 0,
    },
    storageByProvider: storage,
    usageByDay: growth,
    topUsers,
    recentUsers,
    runtime: {
      environment: ctx.env.ENVIRONMENT ?? "development",
      emailConfigured: Boolean(ctx.env.RESEND_API_KEY),
      encryptionConfigured: Boolean(ctx.env.TOKEN_ENCRYPTION_KEY || ctx.env.SESSION_SECRET),
      appVersion: (await getSettings(ctx.env)).app_version ?? "1.0.0",
    },
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function users(ctx: Ctx): Promise<Response> {
  const search = queryValue(ctx.url, "search");
  const limit = queryInt(ctx.url, "limit", { fallback: 25, min: 1, max: 100 });
  const page = queryInt(ctx.url, "page", { fallback: 1, min: 1 });
  const offset = (page - 1) * limit;

  const where = search ? `WHERE (u.email LIKE ? OR u.display_name LIKE ?)` : "";
  const bindings = search ? [`%${search}%`, `%${search}%`] : [];

  const rows = await all<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role, u.status, u.email_verified,
            u.storage_quota_bytes, u.last_login_at, u.created_at,
            COALESCE(SUM(f.size), 0) AS used_bytes, COUNT(f.id) AS file_count,
            (SELECT COUNT(*) FROM providers p WHERE p.user_id = u.id) AS provider_count
       FROM users u LEFT JOIN files f ON f.user_id = u.id AND f.trashed_at IS NULL AND f.is_folder = 0
       ${where}
      GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ...bindings,
    limit,
    offset,
  );

  const total = (
    await first<{ count: number }>(ctx.env.DB, `SELECT COUNT(*) AS count FROM users u ${where}`, ...bindings)
  )?.count ?? 0;

  return json({ users: rows, total, page, limit });
}

export async function updateUser(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const target = await first<UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, ctx.params.id);
  if (!target) throw notFound("That account does not exist.");

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const role = optionalString(input, "role", { max: 20 });
  const status = optionalString(input, "status", { max: 20 });
  const quotaGb = optionalInt(input, "storageQuotaGb", { min: 0, max: 100_000, label: "Storage allowance" });
  const newPassword = optionalString(input, "password", { max: 200 });

  if (target.id === admin.id && (role === "user" || status === "suspended")) {
    throw badRequest("You cannot remove your own administrator access or suspend yourself.");
  }
  if (role && !["user", "admin"].includes(role)) throw badRequest("Role must be user or admin.");
  if (status && !["active", "suspended"].includes(status)) throw badRequest("Status must be active or suspended.");

  if (role === "user" && target.role === "admin") {
    const admins = await first<{ count: number }>(ctx.env.DB, `SELECT COUNT(*) AS count FROM users WHERE role = 'admin'`);
    if ((admins?.count ?? 0) <= 1) throw badRequest("You cannot demote the only administrator account.");
  }

  await run(
    ctx.env.DB,
    `UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status),
                      storage_quota_bytes = COALESCE(?, storage_quota_bytes), updated_at = ?
      WHERE id = ?`,
    role ?? null,
    status ?? null,
    quotaGb === undefined ? null : Math.round(quotaGb * 1024 ** 3),
    nowIso(),
    target.id,
  );

  if (newPassword) await setPassword(ctx.env, target.id, newPassword);

  if (status === "suspended") {
    await run(ctx.env.DB, `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`, nowIso(), target.id);
  }

  await record(ctx.env, {
    action: "admin.user_updated",
    user: admin,
    resourceType: "user",
    resourceId: target.id,
    ctx,
    details: { role, status, quotaGb, passwordReset: Boolean(newPassword) },
  });

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function settings(ctx: Ctx): Promise<Response> {
  const current = await getSettings(ctx.env);
  const rows = await all<{ key: string; description: string; updated_at: string }>(
    ctx.env.DB,
    `SELECT key, description, updated_at FROM system_settings`,
  );
  const descriptions = new Map(rows.map((row) => [row.key, row]));

  return json({
    settings: SETTINGS.map((definition) => ({
      key: definition.key,
      group: definition.group,
      description: descriptions.get(definition.key)?.description ?? definition.description,
      default: definition.value,
      value: current[definition.key] ?? definition.value,
      type: typeof definition.value,
      updatedAt: descriptions.get(definition.key)?.updated_at ?? null,
    })),
  });
}

export async function updateSettingsRoute(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const updates = (input.settings ?? input) as Record<string, unknown>;
  if (typeof updates !== "object" || updates === null || Array.isArray(updates)) {
    throw badRequest("Send the settings as an object of key/value pairs.");
  }

  const known = new Set(SETTINGS.map((definition) => definition.key));
  const unknown = Object.keys(updates).filter((key) => !known.has(key));
  if (unknown.length > 0) throw badRequest(`Unknown settings: ${unknown.join(", ")}`);

  const accepted = await updateSettings(ctx.env, updates as Record<string, string | number | boolean>);
  await record(ctx.env, {
    action: "admin.settings_updated",
    user: admin,
    resourceType: "settings",
    ctx,
    details: { keys: accepted },
  });

  return json({ ok: true, updated: accepted });
}

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export async function providers(ctx: Ctx): Promise<Response> {
  const configs = await listProviderConfigs(ctx.env);
  return json({
    providers: configs.map((config) => ({
      name: config.provider_name,
      displayName: config.display_name,
      authType: config.auth_type,
      clientId: config.client_id,
      hasSecret: Boolean(config.client_secret),
      scopes: config.scopes,
      authorizeUrl: config.authorize_url,
      tokenUrl: config.token_url,
      isEnabled: Boolean(config.is_enabled),
      isConfigured: Boolean(config.is_configured),
      updatedAt: config.updated_at,
    })),
  });
}

export async function updateProvider(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const name = ctx.params.provider;
  const config = await first<{ provider_name: string }>(ctx.env.DB, `SELECT provider_name FROM provider_configs WHERE provider_name = ?`, name);
  if (!config) throw notFound("Unknown provider.");

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const clientId = optionalString(input, "clientId", { max: 400 });
  const clientSecret = optionalString(input, "clientSecret", { max: 600 });
  const scopes = optionalString(input, "scopes", { max: 1000 });
  const enabled = optionalBool(input, "isEnabled");

  const secretToStore = clientSecret ? await seal(clientSecret, ctx.env.TOKEN_ENCRYPTION_KEY || ctx.env.SESSION_SECRET || "") : null;

  const existing = await first<{ client_id: string | null; client_secret: string | null }>(
    ctx.env.DB,
    `SELECT client_id, client_secret FROM provider_configs WHERE provider_name = ?`,
    name,
  );

  const nextClientId = clientId ?? existing?.client_id ?? null;
  const nextSecret = secretToStore ?? existing?.client_secret ?? null;
  const configured = Boolean(nextClientId && (nextSecret || name === "cloudgather"));

  await run(
    ctx.env.DB,
    `UPDATE provider_configs
        SET client_id = ?, client_secret = ?, scopes = COALESCE(?, scopes), is_enabled = COALESCE(?, is_enabled),
            is_configured = ?, updated_at = ?
      WHERE provider_name = ?`,
    nextClientId,
    nextSecret,
    scopes ?? null,
    enabled === undefined ? null : enabled ? 1 : 0,
    configured ? 1 : 0,
    nowIso(),
    name,
  );

  await record(ctx.env, {
    action: "admin.provider_updated",
    user: admin,
    resourceType: "provider_config",
    resourceId: name,
    ctx,
    details: { clientIdSet: Boolean(clientId), secretSet: Boolean(clientSecret), enabled, configured },
  });

  return json({ ok: true, isConfigured: configured });
}

// ---------------------------------------------------------------------------
// Audit, messages and usage
// ---------------------------------------------------------------------------

export async function audit(ctx: Ctx): Promise<Response> {
  const limit = queryInt(ctx.url, "limit", { fallback: 50, min: 1, max: 200 });
  const page = queryInt(ctx.url, "page", { fallback: 1, min: 1 });
  const action = queryValue(ctx.url, "action");
  const userId = queryValue(ctx.url, "userId");
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const bindings: unknown[] = [];
  if (action) {
    conditions.push("action = ?");
    bindings.push(action);
  }
  if (userId) {
    conditions.push("user_id = ?");
    bindings.push(userId);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await all<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...bindings,
    limit,
    offset,
  );
  const total = (await first<{ count: number }>(ctx.env.DB, `SELECT COUNT(*) AS count FROM audit_logs ${where}`, ...bindings))?.count ?? 0;

  return json({ events: rows, total, page, limit });
}

export async function messages(ctx: Ctx): Promise<Response> {
  const status = queryValue(ctx.url, "status");
  const rows = await all<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT * FROM contact_messages ${status ? "WHERE status = ?" : ""} ORDER BY created_at DESC LIMIT 200`,
    ...(status ? [status] : []),
  );
  return json({ messages: rows });
}

export async function updateMessage(ctx: Ctx): Promise<Response> {
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = requireString(input, "status", { label: "Status", max: 20 });
  if (!["new", "read", "replied", "archived"].includes(status)) throw badRequest("Unsupported status.");
  const result = await run(ctx.env.DB, `UPDATE contact_messages SET status = ? WHERE id = ?`, status, ctx.params.id);
  if ((result.meta.changes ?? 0) === 0) throw notFound("That message does not exist.");
  return json({ ok: true });
}

export async function usage(ctx: Ctx): Promise<Response> {
  const days = queryInt(ctx.url, "days", { fallback: 30, min: 1, max: 365 });
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await all<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT day, SUM(uploads) AS uploads, SUM(downloads) AS downloads, SUM(deletes) AS deletes,
            SUM(shares_created) AS shares_created, SUM(api_calls) AS api_calls,
            SUM(bytes_uploaded) AS bytes_uploaded, SUM(bytes_downloaded) AS bytes_downloaded
       FROM usage_daily WHERE day >= ? GROUP BY day ORDER BY day DESC`,
    since,
  );
  return json({ days: rows });
}

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function estimateReadMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function blogList(ctx: Ctx): Promise<Response> {
  const posts = await all<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT id, slug, title, excerpt, tags, status, author, read_minutes, published_at, updated_at, created_at,
            length(content_md) AS content_length
       FROM blog_posts ORDER BY created_at DESC LIMIT 200`,
  );
  return json({
    posts: posts.map((post) => ({ ...post, tags: parseJson<string[]>(post.tags as string, []) })),
  });
}

export async function blogGet(ctx: Ctx): Promise<Response> {
  const post = await first<Record<string, unknown>>(ctx.env.DB, `SELECT * FROM blog_posts WHERE id = ?`, ctx.params.id);
  if (!post) throw notFound("That post does not exist.");
  return json({ post: { ...post, tags: parseJson<string[]>(post.tags as string, []) } });
}

export async function blogCreate(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  const title = requireString(input, "title", { label: "Title", max: 200 });
  const contentMd = requireString(input, "contentMd", { label: "Content", min: 20, max: 200_000 });
  const excerpt = optionalString(input, "excerpt", { max: 400 }) ?? `${contentMd.replace(/[#*`>]/g, "").trim().slice(0, 180)}…`;
  const status = optionalString(input, "status", { max: 20 }) ?? "draft";
  if (!["draft", "published", "archived"].includes(status)) throw badRequest("Status must be draft, published or archived.");

  const requestedSlug = optionalString(input, "slug", { max: 120 });
  let slug = slugify(requestedSlug || title);
  if (!slug) throw badRequest("That title does not produce a usable URL. Add a slug.");

  const clash = await first<{ id: string }>(ctx.env.DB, `SELECT id FROM blog_posts WHERE slug = ?`, slug);
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const tags = Array.isArray(input.tags) ? (input.tags as unknown[]).map(String).slice(0, 8) : [];
  const id = newId("post");
  const timestamp = nowIso();

  await run(
    ctx.env.DB,
    `INSERT INTO blog_posts (id, slug, title, excerpt, content_md, cover_image, tags, status, author, read_minutes, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    slug,
    title,
    excerpt,
    contentMd,
    optionalString(input, "coverImage", { max: 400 }) ?? null,
    JSON.stringify(tags),
    status,
    optionalString(input, "author", { max: 120 }) ?? admin.display_name ?? "CloudGather Team",
    estimateReadMinutes(contentMd),
    status === "published" ? timestamp : null,
    timestamp,
    timestamp,
  );

  await record(ctx.env, { action: "admin.blog_created", user: admin, resourceType: "post", resourceId: id, ctx, details: { slug, status } });
  return created({ post: { id, slug, status } });
}

export async function blogUpdate(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const post = await first<{ id: string; status: string; published_at: string | null }>(
    ctx.env.DB,
    `SELECT id, status, published_at FROM blog_posts WHERE id = ?`,
    ctx.params.id,
  );
  if (!post) throw notFound("That post does not exist.");

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = optionalString(input, "title", { max: 200 });
  const excerpt = optionalString(input, "excerpt", { max: 400 });
  const contentMd = optionalString(input, "contentMd", { max: 200_000 });
  const status = optionalString(input, "status", { max: 20 });
  if (status && !["draft", "published", "archived"].includes(status)) throw badRequest("Unsupported status.");
  const coverImage = optionalString(input, "coverImage", { max: 400 });
  const tags = Array.isArray(input.tags) ? (input.tags as unknown[]).map(String).slice(0, 8) : undefined;

  const readMinutes = contentMd ? estimateReadMinutes(contentMd) : undefined;
  const publishedAt = status === "published" && !post.published_at ? nowIso() : post.published_at;

  await run(
    ctx.env.DB,
    `UPDATE blog_posts
        SET title = COALESCE(?, title), excerpt = COALESCE(?, excerpt), content_md = COALESCE(?, content_md),
            cover_image = COALESCE(?, cover_image), tags = COALESCE(?, tags), status = COALESCE(?, status),
            read_minutes = COALESCE(?, read_minutes), published_at = ?, updated_at = ?
      WHERE id = ?`,
    title ?? null,
    excerpt ?? null,
    contentMd ?? null,
    coverImage ?? null,
    tags ? JSON.stringify(tags) : null,
    status ?? null,
    readMinutes ?? null,
    publishedAt,
    nowIso(),
    post.id,
  );

  await record(ctx.env, { action: "admin.blog_updated", user: admin, resourceType: "post", resourceId: post.id, ctx, details: { status } });
  return json({ ok: true });
}

export async function blogDelete(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const result = await run(ctx.env.DB, `DELETE FROM blog_posts WHERE id = ?`, ctx.params.id);
  if ((result.meta.changes ?? 0) === 0) throw notFound("That post does not exist.");
  await record(ctx.env, { action: "admin.blog_deleted", user: admin, resourceType: "post", resourceId: ctx.params.id, ctx });
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Maintenance actions
// ---------------------------------------------------------------------------

/** Manual trigger for the nightly housekeeping, useful after a big cleanup. */
export async function maintenance(ctx: Ctx): Promise<Response> {
  const admin = currentUser(ctx);
  const settings = await getSettings(ctx.env);
  const { runMaintenance } = await import("../lib/maintenance");
  const summary = await runMaintenance(ctx.env, numericSetting(settings, "trash_retention_days", 30), { includeHeavy: true });
  await record(ctx.env, { action: "admin.maintenance_run", user: admin, ctx, details: { ...summary } });
  return json({ ok: true, ...summary });
}
