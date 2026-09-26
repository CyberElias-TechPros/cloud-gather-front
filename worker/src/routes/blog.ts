/** Public blog delivery plus the admin-side content management endpoints. */
import { Router } from "../core/router";
import { requireAdmin } from "../core/context";
import { all, count, first, pageParams, paged, run } from "../core/db";
import { badRequest, conflict, json, noContent, notFound, readJson } from "../core/http";
import { audit } from "../core/audit";
import { id, likeEscape, now, parseJson, slugify } from "../core/util";
import { optionalString, optionalUrl, requireArray, requireString } from "../core/validate";

export const blogRoutes = new Router();

const PUBLIC_COLUMNS =
  "id, slug, title, excerpt, content, author, category, tags, image, published_at, reading_minutes, seo_title, seo_description, view_count, featured, created_at, updated_at";

const readingMinutes = (content: string) => Math.max(1, Math.round(content.trim().split(/\s+/).length / 220));

const shape = (row: Record<string, unknown>) => ({
  ...row,
  tags: parseJson<string[]>(row.tags as string, []),
  featured: Boolean(row.featured),
  date: row.published_at || row.created_at,
});

async function uniqueSlug(env: Parameters<typeof first>[0], base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || `post-${Date.now()}`;
  let candidate = root;
  for (let attempt = 2; attempt < 50; attempt += 1) {
    const clash = await first<{ id: string }>(env, "SELECT id FROM blog_posts WHERE slug = ?", candidate);
    if (!clash || clash.id === ignoreId) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${Date.now()}`;
}

/* -------------------------------------------------------------- public */

blogRoutes.get("/api/blog", async (ctx) => {
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 24, 100);
  const category = url.searchParams.get("category");
  const tag = url.searchParams.get("tag");
  const query = url.searchParams.get("q");

  const clauses = ["published = 1", "(published_at IS NULL OR datetime(published_at) <= datetime('now'))"];
  const args: unknown[] = [];
  if (category && category.toLowerCase() !== "all") {
    clauses.push("category = ?");
    args.push(category);
  }
  if (tag) {
    clauses.push("tags LIKE ? ESCAPE '\\'");
    args.push(`%"${likeEscape(tag)}"%`);
  }
  if (query) {
    clauses.push("(title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')");
    const like = `%${likeEscape(query)}%`;
    args.push(like, like, like);
  }
  const where = `WHERE ${clauses.join(" AND ")}`;

  const total = await count(ctx.env, `SELECT COUNT(*) AS total FROM blog_posts ${where}`, ...args);
  const rows = await all(
    ctx.env,
    `SELECT ${PUBLIC_COLUMNS} FROM blog_posts ${where} ORDER BY featured DESC, COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
    ...args,
    params.limit,
    params.offset,
  );
  const page = paged(rows.map(shape), total, params);
  return json({ posts: page.items, ...page });
}, { maintenanceSafe: true, summary: "List published blog posts" });

blogRoutes.get("/api/blog/categories", async (ctx) => {
  const rows = await all<{ category: string; total: number }>(
    ctx.env,
    "SELECT category, COUNT(*) AS total FROM blog_posts WHERE published = 1 GROUP BY category ORDER BY total DESC",
  );
  return json({ categories: rows });
}, { maintenanceSafe: true });

blogRoutes.get("/api/blog/:slug", async (ctx) => {
  const row = await first<Record<string, unknown>>(
    ctx.env,
    `SELECT ${PUBLIC_COLUMNS} FROM blog_posts WHERE slug = ? AND published = 1`,
    ctx.params.slug,
  );
  if (!row) throw notFound("That article does not exist.", "post_not_found");
  ctx.waitUntil(
    run(ctx.env, "UPDATE blog_posts SET view_count = view_count + 1 WHERE slug = ?", ctx.params.slug).then(
      () => undefined,
      () => undefined,
    ),
  );
  const related = await all(
    ctx.env,
    `SELECT id, slug, title, excerpt, image, category, published_at, reading_minutes FROM blog_posts
      WHERE published = 1 AND category = ? AND slug != ? ORDER BY COALESCE(published_at, created_at) DESC LIMIT 3`,
    row.category,
    ctx.params.slug,
  );
  return json({ post: shape(row), related: related.map(shape) });
}, { maintenanceSafe: true, summary: "Read a single published article" });

/* --------------------------------------------------------------- admin */

blogRoutes.get("/api/admin/blog", async (ctx) => {
  requireAdmin(ctx);
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 50, 200);
  const total = await count(ctx.env, "SELECT COUNT(*) AS total FROM blog_posts");
  const rows = await all(
    ctx.env,
    `SELECT ${PUBLIC_COLUMNS}, published FROM blog_posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`,
    params.limit,
    params.offset,
  );
  return json(paged(rows.map(shape), total, params));
}, { admin: true, summary: "Admin: list every post, draft or live" });

blogRoutes.post("/api/admin/blog", async (ctx) => {
  const admin = requireAdmin(ctx);
  const payload = await readJson<Record<string, unknown>>(ctx.request);
  const title = requireString(payload.title, "Title", { min: 3, max: 200 });
  const content = requireString(payload.content, "Content", { min: 20, max: 200_000 });
  const excerpt = optionalString(payload.excerpt, "Excerpt", 400) || `${content.replace(/[#*_>`]/g, "").slice(0, 180)}…`;
  const slug = await uniqueSlug(ctx.env, (payload.slug as string) || title);
  const tags = payload.tags === undefined ? [] : requireArray<string>(payload.tags, "Tags", 20).map((tag) => String(tag).slice(0, 40));
  const published = Boolean(payload.published);

  const postId = id();
  await run(
    ctx.env,
    `INSERT INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at,
                            author_id, reading_minutes, seo_title, seo_description, featured)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    postId,
    slug,
    title,
    excerpt,
    content,
    optionalString(payload.author, "Author", 120) || admin.display_name,
    optionalString(payload.category, "Category", 60) || "Product",
    JSON.stringify(tags),
    payload.image ? optionalUrl(payload.image, "Image URL") : null,
    published ? 1 : 0,
    published ? (optionalString(payload.published_at, "Publish date", 40) || now()) : null,
    admin.id,
    readingMinutes(content),
    optionalString(payload.seo_title, "SEO title", 200),
    optionalString(payload.seo_description, "SEO description", 320),
    payload.featured ? 1 : 0,
  );
  await audit(ctx, { action: "admin.blog_created", resourceType: "blog_post", resourceId: postId, details: { slug } });
  const created = await first(ctx.env, `SELECT ${PUBLIC_COLUMNS}, published FROM blog_posts WHERE id = ?`, postId);
  return json({ post: created ? shape(created) : null }, 201);
}, { admin: true, summary: "Admin: create a post" });

blogRoutes.patch("/api/admin/blog/:id", async (ctx) => {
  requireAdmin(ctx);
  const existing = await first<{ id: string; published: number; content: string }>(
    ctx.env,
    "SELECT id, published, content FROM blog_posts WHERE id = ?",
    ctx.params.id,
  );
  if (!existing) throw notFound("Post not found.", "post_not_found");
  const payload = await readJson<Record<string, unknown>>(ctx.request);

  const updates: string[] = [];
  const args: unknown[] = [];
  const set = (column: string, value: unknown) => {
    updates.push(`${column} = ?`);
    args.push(value);
  };

  if (payload.title !== undefined) set("title", requireString(payload.title, "Title", { min: 3, max: 200 }));
  if (payload.slug !== undefined) {
    const slug = await uniqueSlug(ctx.env, String(payload.slug), existing.id);
    set("slug", slug);
  }
  if (payload.excerpt !== undefined) set("excerpt", requireString(payload.excerpt, "Excerpt", { min: 10, max: 400 }));
  if (payload.content !== undefined) {
    const content = requireString(payload.content, "Content", { min: 20, max: 200_000 });
    set("content", content);
    set("reading_minutes", readingMinutes(content));
  }
  if (payload.author !== undefined) set("author", requireString(payload.author, "Author", { min: 2, max: 120 }));
  if (payload.category !== undefined) set("category", requireString(payload.category, "Category", { min: 2, max: 60 }));
  if (payload.tags !== undefined) set("tags", JSON.stringify(requireArray<string>(payload.tags, "Tags", 20).map((tag) => String(tag).slice(0, 40))));
  if (payload.image !== undefined) set("image", payload.image === null ? null : optionalUrl(payload.image, "Image URL"));
  if (payload.seo_title !== undefined) set("seo_title", optionalString(payload.seo_title, "SEO title", 200));
  if (payload.seo_description !== undefined) set("seo_description", optionalString(payload.seo_description, "SEO description", 320));
  if (payload.featured !== undefined) set("featured", payload.featured ? 1 : 0);
  if (payload.published !== undefined) {
    const publish = Boolean(payload.published);
    set("published", publish ? 1 : 0);
    if (publish && !existing.published) set("published_at", now());
    if (!publish) set("published_at", null);
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");

  set("updated_at", now());
  args.push(ctx.params.id);
  await run(ctx.env, `UPDATE blog_posts SET ${updates.join(", ")} WHERE id = ?`, ...args);
  await audit(ctx, { action: "admin.blog_updated", resourceType: "blog_post", resourceId: ctx.params.id });
  const updated = await first(ctx.env, `SELECT ${PUBLIC_COLUMNS}, published FROM blog_posts WHERE id = ?`, ctx.params.id);
  return json({ post: updated ? shape(updated) : null });
}, { admin: true, summary: "Admin: edit a post" });

blogRoutes.delete("/api/admin/blog/:id", async (ctx) => {
  requireAdmin(ctx);
  const result = await run(ctx.env, "DELETE FROM blog_posts WHERE id = ?", ctx.params.id);
  if (!result.meta.changes) throw notFound("Post not found.", "post_not_found");
  await audit(ctx, { action: "admin.blog_deleted", resourceType: "blog_post", resourceId: ctx.params.id, severity: "warning" });
  return noContent();
}, { admin: true });

blogRoutes.post("/api/admin/blog/:id/duplicate", async (ctx) => {
  const admin = requireAdmin(ctx);
  const source = await first<Record<string, unknown>>(ctx.env, "SELECT * FROM blog_posts WHERE id = ?", ctx.params.id);
  if (!source) throw notFound("Post not found.", "post_not_found");
  const slug = await uniqueSlug(ctx.env, `${source.slug}-copy`);
  const copyId = id();
  await run(
    ctx.env,
    `INSERT INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, author_id, reading_minutes, seo_title, seo_description)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
    copyId,
    slug,
    `${source.title} (copy)`,
    source.excerpt,
    source.content,
    source.author,
    source.category,
    source.tags,
    source.image,
    admin.id,
    source.reading_minutes ?? 4,
    source.seo_title ?? null,
    source.seo_description ?? null,
  ).catch(() => {
    throw conflict("Could not duplicate this post.", "duplicate_failed");
  });
  const created = await first(ctx.env, `SELECT ${PUBLIC_COLUMNS}, published FROM blog_posts WHERE id = ?`, copyId);
  return json({ post: created ? shape(created) : null }, 201);
}, { admin: true });
