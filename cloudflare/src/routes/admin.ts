/**
 * Admin console API. Every route is gated by `requireAdmin`; the role itself is
 * never client-writable (users cannot PATCH their own role).
 */

import { Router } from "../lib/router";
import { badRequest, clientIp, json, notFound, readJson, validationFailed } from "../lib/http";
import { v } from "../lib/validate";
import { requireAdmin, requireSessionAuth } from "../middleware";
import { recordAudit } from "../lib/events";
import { loadSettings, invalidateSettingsCache, DEFAULT_SETTINGS } from "../lib/settings";
import { encryptSecret, randomId } from "../lib/crypto";

export function adminRoutes(router: Router): void {
  // ── Overview ─────────────────────────────────────────────────────────────
  router.get("/api/admin/stats", requireAdmin, requireSessionAuth, async (ctx) => {
    const [users, files, providers, shares, keys, storage, recentUsers, usage] = await Promise.all([
      ctx.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN created_at > ?1 THEN 1 ELSE 0 END) AS recent FROM users")
        .bind(new Date(Date.now() - 7 * 86_400_000).toISOString())
        .first<{ total: number; active: number; recent: number }>(),
      ctx.env.DB.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN is_folder = 0 THEN size ELSE 0 END),0) AS bytes FROM files WHERE trashed_at IS NULL")
        .first<{ total: number; bytes: number }>(),
      ctx.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) AS connected FROM providers")
        .first<{ total: number; connected: number }>(),
      ctx.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END) AS active FROM shares")
        .first<{ total: number; active: number }>(),
      ctx.env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN revoked_at IS NULL THEN 1 ELSE 0 END) AS active FROM api_keys")
        .first<{ total: number; active: number }>(),
      ctx.env.DB.prepare("SELECT COALESCE(SUM(bytes_uploaded),0) AS uploaded, COALESCE(SUM(bytes_downloaded),0) AS downloaded, COALESCE(SUM(api_calls),0) AS api_calls FROM usage_daily")
        .first<{ uploaded: number; downloaded: number; api_calls: number }>(),
      ctx.env.DB.prepare(
        `SELECT day, SUM(uploads) AS uploads, SUM(downloads) AS downloads, SUM(api_calls) AS api_calls FROM usage_daily
          GROUP BY day ORDER BY day DESC LIMIT 30`,
      ).all(),
      ctx.env.DB.prepare(
        `SELECT u.id, u.email, u.display_name, u.role, u.status, u.created_at,
                (SELECT COALESCE(SUM(size),0) FROM files f WHERE f.user_id = u.id AND f.is_folder = 0 AND f.trashed_at IS NULL) AS used_bytes
           FROM users u ORDER BY u.created_at DESC LIMIT 8`,
      ).all(),
    ]);

    const topUsers = await ctx.env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, COALESCE(SUM(f.size),0) AS used_bytes, COUNT(f.id) AS file_count
         FROM users u LEFT JOIN files f ON f.user_id = u.id AND f.is_folder = 0 AND f.trashed_at IS NULL
        GROUP BY u.id ORDER BY used_bytes DESC LIMIT 8`,
    ).all();

    return json({
      totals: {
        users: users?.total ?? 0,
        activeUsers: users?.active ?? 0,
        newUsersThisWeek: users?.recent ?? 0,
        files: files?.total ?? 0,
        storedBytes: files?.bytes ?? 0,
        providers: providers?.total ?? 0,
        connectedProviders: providers?.connected ?? 0,
        shares: shares?.total ?? 0,
        activeShares: shares?.active ?? 0,
        apiKeys: keys?.total ?? 0,
        activeApiKeys: keys?.active ?? 0,
        bytesUploaded: storage?.uploaded ?? 0,
        bytesDownloaded: storage?.downloaded ?? 0,
        apiCalls: storage?.api_calls ?? 0,
      },
      usageByDay: usage.results ?? [],
      recentUsers: recentUsers.results ?? [],
      topUsers: topUsers.results ?? [],
      runtime: {
        environment: ctx.env.ENVIRONMENT,
        emailConfigured: Boolean(ctx.env.RESEND_API_KEY),
        encryptionConfigured: Boolean(ctx.env.TOKEN_ENCRYPTION_KEY),
      },
    });
  });

  // ── Users ────────────────────────────────────────────────────────────────
  router.get("/api/admin/users", requireAdmin, requireSessionAuth, async (ctx) => {
    const search = (ctx.url.searchParams.get("search") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number(ctx.url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(ctx.url.searchParams.get("limit") ?? 25) || 25));
    const offset = (page - 1) * limit;

    const where = search ? "WHERE lower(u.email) LIKE ?1 OR lower(COALESCE(u.display_name,'')) LIKE ?1" : "";
    const binds: unknown[] = search ? [`%${search}%`] : [];

    const rows = await ctx.env.DB.prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.status, u.email_verified, u.storage_quota_bytes,
              u.created_at, u.last_login_at,
              (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id AND f.trashed_at IS NULL) AS file_count,
              (SELECT COALESCE(SUM(f.size),0) FROM files f WHERE f.user_id = u.id AND f.is_folder = 0 AND f.trashed_at IS NULL) AS used_bytes,
              (SELECT COUNT(*) FROM providers p WHERE p.user_id = u.id AND p.status = 'connected') AS providers
         FROM users u ${where}
        ORDER BY u.created_at DESC LIMIT ?${binds.push(limit) as number} OFFSET ?${binds.push(offset) as number}`,
    )
      .bind(...binds)
      .all<Record<string, unknown>>();

    const totalBinds = search ? [`%${search}%`] : [];
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS total FROM users u ${where}`)
      .bind(...totalBinds)
      .first<{ total: number }>();

    return json({ users: rows.results ?? [], total: total?.total ?? 0, page, limit });
  });

  router.patch("/api/admin/users/:id", requireAdmin, requireSessionAuth, async (ctx) => {
    const parsed = v
      .object({
        role: v.literal(["user", "admin"] as const).optional(),
        status: v.literal(["active", "suspended"] as const).optional(),
        storageQuotaGb: v.int({ min: 0, max: 100000 }).nullable().optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    if (ctx.params.id === ctx.user!.id && (parsed.value.role === "user" || parsed.value.status === "suspended")) {
      throw badRequest("You cannot remove your own admin access or suspend yourself.");
    }

    const target = await ctx.env.DB.prepare("SELECT id, email FROM users WHERE id = ?1").bind(ctx.params.id).first<{ id: string; email: string }>();
    if (!target) throw notFound("That user does not exist.");

    const quotaBytes =
      parsed.value.storageQuotaGb === undefined
        ? null
        : parsed.value.storageQuotaGb === null
          ? null
          : parsed.value.storageQuotaGb * 1024 * 1024 * 1024;

    await ctx.env.DB.prepare(
      `UPDATE users SET
         role = COALESCE(?1, role),
         status = COALESCE(?2, status),
         storage_quota_bytes = CASE WHEN ?3 = 1 THEN ?4 ELSE storage_quota_bytes END,
         updated_at = ?5
       WHERE id = ?6`,
    )
      .bind(
        parsed.value.role ?? null,
        parsed.value.status ?? null,
        parsed.value.storageQuotaGb === undefined ? 0 : 1,
        quotaBytes,
        new Date().toISOString(),
        target.id,
      )
      .run();

    if (parsed.value.status === "suspended") {
      await ctx.env.DB.prepare("UPDATE sessions SET revoked_at = ?1 WHERE user_id = ?2 AND revoked_at IS NULL")
        .bind(new Date().toISOString(), target.id)
        .run();
    }

    ctx.waitUntil(recordAudit(ctx.env, {
      userId: ctx.user!.id,
      actorEmail: ctx.user!.email,
      action: "admin.user_updated",
      resourceType: "user",
      resourceId: target.id,
      details: { ...parsed.value },
      ip: clientIp(ctx.req),
    }));

    return json({ ok: true });
  });

  // ── Settings ─────────────────────────────────────────────────────────────
  router.get("/api/admin/settings", requireAdmin, requireSessionAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare("SELECT key, value, description, updated_at FROM system_settings ORDER BY key ASC")
      .all<{ key: string; value: string; description: string; updated_at: string }>();
    return json({
      settings: (rows.results ?? []).map((row) => ({
        key: row.key,
        value: safeParse(row.value),
        description: row.description,
        updatedAt: row.updated_at,
        type: typeof (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[row.key],
      })),
      defaults: DEFAULT_SETTINGS,
    });
  });

  router.patch("/api/admin/settings", requireAdmin, requireSessionAuth, async (ctx) => {
    const parsed = v.object({ settings: v.record(v.string({ max: 500 })) }).parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
    const updates: Array<[string, string]> = [];
    for (const [key, raw] of Object.entries(parsed.value.settings)) {
      if (!allowed.has(key)) continue;
      const fallback = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key];
      let value: unknown = raw;
      if (typeof fallback === "number") {
        const num = Number(raw);
        if (!Number.isFinite(num)) throw validationFailed([`${key} must be a number`]);
        value = num;
      } else if (typeof fallback === "boolean") {
        value = raw === "true" || raw === "1";
      } else if (Array.isArray(fallback)) {
        try {
          const list = JSON.parse(raw);
          if (!Array.isArray(list)) throw new Error();
          value = list.map(String);
        } catch {
          throw validationFailed([`${key} must be a JSON array`]);
        }
      }
      updates.push([key, JSON.stringify(value)]);
    }
    if (updates.length === 0) throw badRequest("No recognised settings were supplied.");

    const now = new Date().toISOString();
    for (const [key, value] of updates) {
      await ctx.env.DB.prepare(
        `INSERT INTO system_settings (key, value, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
        .bind(key, value, now)
        .run();
    }

    await invalidateSettingsCache(ctx.env);
    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "admin.settings_updated", details: { keys: updates.map(([key]) => key) }, ip: clientIp(ctx.req) }));
    return json({ ok: true, updated: updates.map(([key]) => key) });
  });

  // ── Provider configuration ───────────────────────────────────────────────
  router.get("/api/admin/providers", requireAdmin, requireSessionAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare("SELECT * FROM provider_configs ORDER BY sort_order ASC").all<Record<string, unknown>>();
    return json({
      providers: (rows.results ?? []).map((row) => ({
        name: row.provider_name,
        displayName: row.display_name,
        authType: row.auth_type,
        clientId: row.client_id,
        hasSecret: Boolean(row.client_secret),
        scopes: row.scopes,
        authorizeUrl: row.authorize_url,
        tokenUrl: row.token_url,
        isEnabled: row.is_enabled === 1,
        updatedAt: row.updated_at,
      })),
    });
  });

  router.patch("/api/admin/providers/:provider", requireAdmin, requireSessionAuth, async (ctx) => {
    const parsed = v
      .object({
        clientId: v.string({ max: 300 }).nullable().optional(),
        clientSecret: v.string({ max: 500 }).nullable().optional(),
        isEnabled: v.boolean().optional(),
        scopes: v.string({ max: 500 }).nullable().optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const config = await ctx.env.DB.prepare("SELECT * FROM provider_configs WHERE provider_name = ?1")
      .bind(ctx.params.provider)
      .first<{ provider_name: string; client_secret: string | null; client_id: string | null; is_enabled: number }>();
    if (!config) throw notFound("Unknown provider.");

    const secretKey = ctx.env.TOKEN_ENCRYPTION_KEY || ctx.env.SESSION_SECRET || "";
    let encryptedSecret: string | null | undefined;
    if (parsed.value.clientSecret === null) encryptedSecret = null;
    else if (parsed.value.clientSecret) {
      if (!secretKey) throw badRequest("Set the TOKEN_ENCRYPTION_KEY secret before storing provider credentials.");
      encryptedSecret = await encryptSecret(parsed.value.clientSecret, secretKey);
    }

    const nextEnabled =
      parsed.value.isEnabled ??
      (config.is_enabled === 1 ||
        Boolean(parsed.value.clientId ?? config.client_id) && Boolean(encryptedSecret !== undefined ? encryptedSecret : config.client_secret));

    await ctx.env.DB.prepare(
      `UPDATE provider_configs SET
         client_id = CASE WHEN ?1 = 1 THEN ?2 ELSE client_id END,
         client_secret = CASE WHEN ?3 = 1 THEN ?4 ELSE client_secret END,
         scopes = COALESCE(?5, scopes),
         is_enabled = ?6,
         updated_at = ?7
       WHERE provider_name = ?8`,
    )
      .bind(
        parsed.value.clientId === undefined ? 0 : 1,
        parsed.value.clientId ?? null,
        encryptedSecret === undefined ? 0 : 1,
        encryptedSecret ?? null,
        parsed.value.scopes ?? null,
        nextEnabled ? 1 : 0,
        new Date().toISOString(),
        config.provider_name,
      )
      .run();

    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "admin.provider_updated", resourceType: "provider_config", resourceId: config.provider_name, ip: clientIp(ctx.req) }));
    return json({ ok: true });
  });

  // ── Audit log ────────────────────────────────────────────────────────────
  router.get("/api/admin/audit", requireAdmin, requireSessionAuth, async (ctx) => {
    const page = Math.max(1, Number(ctx.url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(ctx.url.searchParams.get("limit") ?? 50) || 50));
    const action = ctx.url.searchParams.get("action");
    const userId = ctx.url.searchParams.get("userId");

    const conditions: string[] = [];
    const binds: unknown[] = [];
    if (action) conditions.push(`action = ?${binds.push(action) as number}`);
    if (userId) conditions.push(`user_id = ?${binds.push(userId) as number}`);
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await ctx.env.DB.prepare(
      `SELECT id, user_id, actor_email, action, resource_type, resource_id, details, ip, created_at
         FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ?${binds.push(limit) as number} OFFSET ?${binds.push((page - 1) * limit) as number}`,
    )
      .bind(...binds)
      .all<Record<string, unknown>>();

    const totalBinds = binds.slice(0, binds.length - 2);
    const total = await ctx.env.DB.prepare(`SELECT COUNT(*) AS total FROM audit_logs ${where}`).bind(...totalBinds).first<{ total: number }>();

    return json({
      events: (rows.results ?? []).map((row) => ({ ...row, details: row.details ? safeParse(row.details as string) : null })),
      total: total?.total ?? 0,
      page,
      limit,
    });
  });

  // ── Contact inbox ────────────────────────────────────────────────────────
  router.get("/api/admin/messages", requireAdmin, requireSessionAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 200").all();
    return json({ messages: rows.results ?? [] });
  });

  router.patch("/api/admin/messages/:id", requireAdmin, requireSessionAuth, async (ctx) => {
    const parsed = v.object({ status: v.literal(["new", "read", "replied", "archived"] as const) }).parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    const result = await ctx.env.DB.prepare("UPDATE contact_messages SET status = ?1 WHERE id = ?2")
      .bind(parsed.value.status, ctx.params.id)
      .run();
    if (!result.meta.changes) throw notFound("That message does not exist.");
    return json({ ok: true });
  });

  // ── Blog authoring ───────────────────────────────────────────────────────
  router.get("/api/admin/blog", requireAdmin, requireSessionAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare("SELECT * FROM blog_posts ORDER BY COALESCE(published_at, created_at) DESC").all<Record<string, unknown>>();
    return json({ posts: (rows.results ?? []).map(mapPost) });
  });

  router.post("/api/admin/blog", requireAdmin, requireSessionAuth, async (ctx) => {
    const parsed = v
      .object({
        title: v.string({ min: 3, max: 200 }),
        slug: v.string({ min: 3, max: 120 }).optional(),
        excerpt: v.string({ max: 400 }).optional(),
        contentMd: v.string({ min: 20, max: 200000 }),
        coverImage: v.string({ max: 500 }).optional(),
        tags: v.array(v.string({ max: 40 }), { max: 10 }).optional(),
        status: v.literal(["draft", "published", "archived"] as const).default("draft"),
        author: v.string({ max: 80 }).optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const slug = (parsed.value.slug ?? slugify(parsed.value.title)).slice(0, 120);
    const existing = await ctx.env.DB.prepare("SELECT id FROM blog_posts WHERE slug = ?1").bind(slug).first();
    if (existing) throw badRequest("A post with that slug already exists.");

    const id = randomId("post");
    const now = new Date().toISOString();
    await ctx.env.DB.prepare(
      `INSERT INTO blog_posts (id, slug, title, excerpt, content_md, cover_image, tags, status, author, read_minutes, published_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)`,
    )
      .bind(
        id,
        slug,
        parsed.value.title,
        parsed.value.excerpt ?? null,
        parsed.value.contentMd,
        parsed.value.coverImage ?? null,
        JSON.stringify(parsed.value.tags ?? []),
        parsed.value.status,
        parsed.value.author ?? ctx.user!.displayName ?? "CloudGather Team",
        estimateReadMinutes(parsed.value.contentMd),
        parsed.value.status === "published" ? now : null,
        now,
      )
      .run();

    return json({ post: { id, slug } }, { status: 201 });
  });

  router.patch("/api/admin/blog/:id", requireAdmin, requireSessionAuth, async (ctx) => {
    const parsed = v
      .object({
        title: v.string({ min: 3, max: 200 }).optional(),
        excerpt: v.string({ max: 400 }).nullable().optional(),
        contentMd: v.string({ min: 20, max: 200000 }).optional(),
        coverImage: v.string({ max: 500 }).nullable().optional(),
        tags: v.array(v.string({ max: 40 }), { max: 10 }).optional(),
        status: v.literal(["draft", "published", "archived"] as const).optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const post = await ctx.env.DB.prepare("SELECT id, status, published_at FROM blog_posts WHERE id = ?1")
      .bind(ctx.params.id)
      .first<{ id: string; status: string; published_at: string | null }>();
    if (!post) throw notFound("That post does not exist.");

    const now = new Date().toISOString();
    const publishingNow = parsed.value.status === "published" && !post.published_at;
    await ctx.env.DB.prepare(
      `UPDATE blog_posts SET
         title = COALESCE(?1, title),
         excerpt = CASE WHEN ?2 = 1 THEN ?3 ELSE excerpt END,
         content_md = COALESCE(?4, content_md),
         cover_image = CASE WHEN ?5 = 1 THEN ?6 ELSE cover_image END,
         tags = COALESCE(?7, tags),
         status = COALESCE(?8, status),
         read_minutes = COALESCE(?9, read_minutes),
         published_at = CASE WHEN ?10 = 1 THEN ?11 ELSE published_at END,
         updated_at = ?11
       WHERE id = ?12`,
    )
      .bind(
        parsed.value.title ?? null,
        parsed.value.excerpt === undefined ? 0 : 1,
        parsed.value.excerpt ?? null,
        parsed.value.contentMd ?? null,
        parsed.value.coverImage === undefined ? 0 : 1,
        parsed.value.coverImage ?? null,
        parsed.value.tags ? JSON.stringify(parsed.value.tags) : null,
        parsed.value.status ?? null,
        parsed.value.contentMd ? estimateReadMinutes(parsed.value.contentMd) : null,
        publishingNow ? 1 : 0,
        now,
        post.id,
      )
      .run();

    return json({ ok: true });
  });

  router.delete("/api/admin/blog/:id", requireAdmin, requireSessionAuth, async (ctx) => {
    const result = await ctx.env.DB.prepare("DELETE FROM blog_posts WHERE id = ?1").bind(ctx.params.id).run();
    if (!result.meta.changes) throw notFound("That post does not exist.");
    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "admin.blog_deleted", resourceType: "blog_post", resourceId: ctx.params.id }));
    return json({ ok: true });
  });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function estimateReadMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function mapPost(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentMd: row.content_md,
    coverImage: row.cover_image,
    tags: safeParse(row.tags as string),
    status: row.status,
    author: row.author,
    readMinutes: row.read_minutes,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeParse(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
