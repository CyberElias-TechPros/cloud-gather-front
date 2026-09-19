/**
 * Public, unauthenticated endpoints (marketing site, SEO, contact form) plus the
 * signed-in activity and notification feeds.
 */

import { Router } from "../lib/router";
import { badRequest, clientIp, json, notFound, readJson, validationFailed } from "../lib/http";
import { v } from "../lib/validate";
import { requireAuth, rateLimit } from "../middleware";
import { loadSettings, publicConfig } from "../lib/settings";
import { notify, recordAudit, sendEmail } from "../lib/events";
import { randomId } from "../lib/crypto";
import { escapeHtml } from "../lib/emailTemplates";

/** Static marketing routes that belong in the sitemap, with their priority. */
const STATIC_ROUTES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/features", changefreq: "monthly", priority: "0.9" },
  { path: "/pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/developers", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/about", changefreq: "yearly", priority: "0.6" },
  { path: "/contact", changefreq: "yearly", priority: "0.5" },
  { path: "/privacypolicy", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

export function publicRoutes(router: Router): void {
  // ── Health ───────────────────────────────────────────────────────────────
  router.get("/api/health", async (ctx) => {
    const checks: Record<string, string> = {};
    try {
      await ctx.env.DB.prepare("SELECT 1").first();
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
    try {
      await ctx.env.CACHE.get("health:probe");
      checks.cache = "ok";
    } catch {
      checks.cache = "error";
    }
    try {
      await ctx.env.FILES.head("health/probe");
      checks.storage = "ok";
    } catch {
      checks.storage = "error";
    }

    const healthy = Object.values(checks).every((value) => value === "ok");
    return json(
      {
        status: healthy ? "ok" : "degraded",
        environment: ctx.env.ENVIRONMENT,
        time: new Date().toISOString(),
        checks,
      },
      { status: healthy ? 200 : 503 },
    );
  });

  // ── Runtime config for the frontend ──────────────────────────────────────
  router.get("/api/config", async (ctx) => {
    const settings = await loadSettings(ctx.env);
    const providers = await ctx.env.DB.prepare(
      "SELECT provider_name, display_name, auth_type, is_enabled FROM provider_configs ORDER BY sort_order ASC",
    ).all<{ provider_name: string; display_name: string; auth_type: string; is_enabled: number }>();

    return json({
      config: publicConfig(ctx.env, settings),
      providers: (providers.results ?? []).map((row) => ({
        name: row.provider_name,
        displayName: row.display_name,
        authType: row.auth_type,
        configured: row.auth_type === "managed" ? true : row.is_enabled === 1,
      })),
    });
  });

  // ── Blog (public read) ───────────────────────────────────────────────────
  router.get("/api/public/blog", async (ctx) => {
    const limit = Math.min(50, Math.max(1, Number(ctx.url.searchParams.get("limit") ?? 12) || 12));
    const tag = ctx.url.searchParams.get("tag");
    const rows = await ctx.env.DB.prepare(
      `SELECT id, slug, title, excerpt, cover_image, tags, author, read_minutes, published_at, updated_at
         FROM blog_posts WHERE status = 'published' ${tag ? "AND tags LIKE ?1" : ""}
        ORDER BY published_at DESC LIMIT ?${tag ? 2 : 1}`,
    )
      .bind(...(tag ? [`%"${tag}"%`, limit] : [limit]))
      .all<Record<string, unknown>>();

    return json({ posts: (rows.results ?? []).map(publicPost) });
  });

  router.get("/api/public/blog/:slug", async (ctx) => {
    const row = await ctx.env.DB.prepare("SELECT * FROM blog_posts WHERE slug = ?1 AND status = 'published'")
      .bind(ctx.params.slug)
      .first<Record<string, unknown>>();
    if (!row) throw notFound("That article does not exist.");
    return json({ post: { ...publicPost(row), contentMd: row.content_md } });
  });

  // ── Contact ──────────────────────────────────────────────────────────────
  router.post("/api/public/contact", rateLimit("contact", 5, 900), async (ctx) => {
    const parsed = v
      .object({
        name: v.string({ min: 2, max: 120 }),
        email: v.email(),
        subject: v.string({ max: 160 }).optional(),
        message: v.string({ min: 10, max: 5000 }),
        // Honeypot: real users never fill this in.
        website: v.string({ max: 200 }).optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    if (parsed.value.website) return json({ ok: true });

    const settings = await loadSettings(ctx.env);
    const id = randomId("msg");
    await ctx.env.DB.prepare(
      "INSERT INTO contact_messages (id, name, email, subject, message, ip, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
      .bind(id, parsed.value.name, parsed.value.email, parsed.value.subject ?? null, parsed.value.message, clientIp(ctx.req), new Date().toISOString())
      .run();

    if (settings.notifications_email_enabled) {
      const html = `<p><strong>${escapeHtml(parsed.value.name)}</strong> &lt;${escapeHtml(parsed.value.email)}&gt; wrote:</p>
        <p>${escapeHtml(parsed.value.message).replace(/\n/g, "<br />")}</p>`;
      ctx.waitUntil(sendEmail(ctx.env, settings.support_email, `[CloudGather] ${parsed.value.subject ?? "New contact message"}`, html));
    }

    return json({ ok: true, message: "Thanks — your message is with us. We reply to every one." }, { status: 201 });
  });

  // ── Sitemap (dynamic: includes published posts) ──────────────────────────
  router.get("/api/public/sitemap.xml", async (ctx) => {
    const posts = await ctx.env.DB.prepare(
      "SELECT slug, updated_at, published_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC",
    ).all<{ slug: string; updated_at: string; published_at: string }>();

    const base = ctx.env.APP_URL.replace(/\/$/, "");
    const urls = [
      ...STATIC_ROUTES.map(
        (route) =>
          `  <url><loc>${base}${route.path}</loc><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`,
      ),
      ...(posts.results ?? []).map(
        (post) =>
          `  <url><loc>${base}/blog/${post.slug}</loc><lastmod>${(post.updated_at ?? post.published_at).slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      ),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

    return new Response(xml, {
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=600",
      },
    });
  });

  // ── Activity feed (signed in) ────────────────────────────────────────────
  router.get("/api/activity", requireAuth, async (ctx) => {
    const limit = Math.min(100, Math.max(1, Number(ctx.url.searchParams.get("limit") ?? 25) || 25));
    const rows = await ctx.env.DB.prepare(
      `SELECT id, action, resource_type, resource_id, details, created_at
         FROM audit_logs WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2`,
    )
      .bind(ctx.user!.id, limit)
      .all<{ id: string; action: string; resource_type: string | null; resource_id: string | null; details: string | null; created_at: string }>();

    return json({
      events: (rows.results ?? []).map((row) => ({
        id: row.id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        details: row.details ? safeParse(row.details) : null,
        createdAt: row.created_at,
      })),
    });
  });

  // ── Notifications ────────────────────────────────────────────────────────
  router.get("/api/notifications", requireAuth, async (ctx) => {
    const unreadOnly = ctx.url.searchParams.get("unread") === "true";
    const rows = await ctx.env.DB.prepare(
      `SELECT id, type, title, body, link, read_at, created_at FROM notifications
        WHERE user_id = ?1 ${unreadOnly ? "AND read_at IS NULL" : ""}
        ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(ctx.user!.id)
      .all<Record<string, unknown>>();

    const unread = await ctx.env.DB.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?1 AND read_at IS NULL")
      .bind(ctx.user!.id)
      .first<{ total: number }>();

    return json({
      notifications: (rows.results ?? []).map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        link: row.link,
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
      unreadCount: unread?.total ?? 0,
    });
  });

  router.post("/api/notifications/read", requireAuth, async (ctx) => {
    const parsed = v.object({ ids: v.array(v.string({ max: 64 }), { max: 100 }).optional() }).parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    const now = new Date().toISOString();

    if (parsed.value.ids && parsed.value.ids.length > 0) {
      const placeholders = parsed.value.ids.map((_, index) => `?${index + 3}`).join(", ");
      await ctx.env.DB.prepare(`UPDATE notifications SET read_at = ?1 WHERE user_id = ?2 AND id IN (${placeholders})`)
        .bind(now, ctx.user!.id, ...parsed.value.ids)
        .run();
    } else {
      await ctx.env.DB.prepare("UPDATE notifications SET read_at = ?1 WHERE user_id = ?2 AND read_at IS NULL")
        .bind(now, ctx.user!.id)
        .run();
    }
    return json({ ok: true });
  });

  router.delete("/api/notifications/:id", requireAuth, async (ctx) => {
    const result = await ctx.env.DB.prepare("DELETE FROM notifications WHERE id = ?1 AND user_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .run();
    if (!result.meta.changes) throw notFound("That notification no longer exists.");
    return json({ ok: true });
  });

  // ── Storage warning helper used by uploads & cron ────────────────────────
  router.post("/api/notifications/test", requireAuth, async (ctx) => {
    await notify(ctx.env, ctx.user!.id, "system", "Test notification", "Notifications are working end to end.", "/dashboard");
    await recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "notifications.test" });
    return json({ ok: true });
  });

  // ── Feedback loop: report a problem with a file ──────────────────────────
  router.post("/api/report", requireAuth, async (ctx) => {
    const parsed = v
      .object({ fileId: v.string({ max: 64 }).optional(), message: v.string({ min: 5, max: 2000 }) })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    await recordAudit(ctx.env, {
      userId: ctx.user!.id,
      actorEmail: ctx.user!.email,
      action: "report.submitted",
      resourceType: "file",
      resourceId: parsed.value.fileId ?? null,
      details: { message: parsed.value.message },
      ip: clientIp(ctx.req),
    });
    return json({ ok: true });
  });
}

function publicPost(row: Record<string, unknown>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    coverImage: row.cover_image,
    tags: safeParse(row.tags as string) ?? [],
    author: row.author,
    readMinutes: row.read_minutes,
    publishedAt: row.published_at,
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

export const __test = { STATIC_ROUTES };
export { badRequest };
