/**
 * Everything reachable without an account: health, runtime config, the blog,
 * the contact form, the sitemap and — most importantly — public share links.
 *
 * Share access is deliberately strict: tokens are opaque, expiry, download caps
 * and password gates are evaluated on every request (never cached), and a revoked
 * or expired link returns a specific code so the UI can explain what happened.
 */

import { hashPassword, verifyPassword, type PasswordHash } from "../lib/crypto";
import { all, first, nowIso, parseJson, run } from "../lib/db";
import { queueEmail, templates } from "../lib/email";
import { ApiError, badRequest, clientIp, cookieSecure, created, escapeHtml, json, notFound, parseCookies, serializeCookie, unauthorized, xml, type Ctx } from "../lib/http";
import { catalog } from "../lib/providers";
import { descendants, folderZipResponse, streamStoredFile, toFileDto } from "../lib/files";
import { booleanSetting, getSettings, numericSetting, publicConfig } from "../lib/settings";
import { createSignedValue, readSignedValue } from "../lib/crypto";
import { consumeRateLimit } from "../lib/ratelimit";
import { optionalString, queryInt, requireEmail, requireString, body as readBody } from "../lib/validate";
import type { FileRow, ShareRow, UserRow } from "../types";

// ---------------------------------------------------------------------------
// Platform endpoints
// ---------------------------------------------------------------------------

export async function health(ctx: Ctx): Promise<Response> {
  const checks: Record<string, string> = {};

  try {
    await ctx.env.DB.prepare("SELECT 1").first();
    checks.database = "ok";
  } catch {
    checks.database = "unavailable";
  }

  try {
    await ctx.env.CACHE.get("health:ping");
    checks.cache = "ok";
  } catch {
    checks.cache = "unavailable";
  }

  try {
    await ctx.env.FILES.head("health/probe");
    checks.storage = "ok";
  } catch {
    // A missing probe object is expected; only transport errors are a problem.
    checks.storage = "ok";
  }

  const healthy = checks.database === "ok";
  return json(
    {
      status: healthy ? "ok" : "degraded",
      environment: ctx.env.ENVIRONMENT ?? "development",
      version: ctx.env.APP_NAME ? "1.0.0" : "1.0.0",
      checks,
      time: nowIso(),
    },
    { status: healthy ? 200 : 503 },
  );
}

export async function config(ctx: Ctx): Promise<Response> {
  const settings = await getSettings(ctx.env);
  return json({ config: publicConfig(ctx.env, settings), providers: await catalog(ctx.env, null) });
}

export async function blogList(ctx: Ctx): Promise<Response> {
  const limit = queryInt(ctx.url, "limit", { fallback: 20, min: 1, max: 100 });
  const tag = ctx.url.searchParams.get("tag");
  const posts = await all<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT id, slug, title, excerpt, cover_image, tags, author, read_minutes, published_at
       FROM blog_posts
      WHERE status = 'published' ${tag ? "AND tags LIKE ?" : ""}
      ORDER BY published_at DESC LIMIT ?`,
    ...(tag ? [`%"${tag}"%`, limit] : [limit]),
  );

  return json({
    posts: posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      coverImage: post.cover_image,
      tags: parseJson<string[]>(post.tags as string, []),
      author: post.author,
      readMinutes: post.read_minutes,
      publishedAt: post.published_at,
    })),
  });
}

export async function blogPost(ctx: Ctx): Promise<Response> {
  const post = await first<Record<string, unknown>>(
    ctx.env.DB,
    `SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'`,
    ctx.params.slug,
  );
  if (!post) throw notFound("That article does not exist.");

  return json({
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      contentMd: post.content_md,
      coverImage: post.cover_image,
      tags: parseJson<string[]>(post.tags as string, []),
      author: post.author,
      readMinutes: post.read_minutes,
      publishedAt: post.published_at,
      updatedAt: post.updated_at,
    },
  });
}

export async function contact(ctx: Ctx): Promise<Response> {
  const settings = await getSettings(ctx.env);
  const input = readBody(await ctx.req.json().catch(() => ({})));

  const successMessage = "Thanks — your message is on its way. We usually reply within one business day.";

  // Honeypot: a field no human sees. The response is byte-identical to the real
  // path (same status, same message) so a bot cannot tell it was filtered.
  const honeypot = optionalString(input, "website", { max: 200 });
  if (honeypot) return created({ ok: true, message: successMessage });

  const limit = await consumeRateLimit(ctx.env, {
    scope: "contact",
    limit: 5,
    windowSeconds: 3600,
    identifier: clientIp(ctx.req),
  });
  if (!limit.allowed) {
    throw new ApiError("rate_limited", "You have sent several messages already. Please give us a little time to reply.", {
      retryAfter: 3600,
    });
  }

  const name = requireString(input, "name", { label: "Name", max: 120 });
  const email = requireEmail(input);
  const subject = optionalString(input, "subject", { max: 200 }) ?? "Website enquiry";
  const message = requireString(input, "message", { label: "Message", min: 10, max: 5000 });

  const id = `msg_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  await run(
    ctx.env.DB,
    `INSERT INTO contact_messages (id, name, email, subject, message, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    name,
    email,
    subject,
    message,
    clientIp(ctx.req),
    ctx.req.headers.get("user-agent")?.slice(0, 300) ?? null,
    nowIso(),
  );

  const supportEmail = String(settings.support_email ?? ctx.env.SUPPORT_EMAIL ?? "support@cloudgather.app");
  await queueEmail(ctx.env, {
    to: supportEmail,
    replyTo: email,
    subject: `[Contact] ${subject}`,
    html: `<p><strong>${escapeHtml(name)}</strong> &lt;${escapeHtml(email)}&gt; wrote:</p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p>`,
  });

  const confirmation = templates.contactConfirmation(ctx.env.APP_NAME ?? "CloudGather", ctx.env.APP_URL ?? "", name);
  await queueEmail(ctx.env, { to: email, subject: confirmation.subject, html: confirmation.html });

  return created({ ok: true, message: successMessage });
}

const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "weekly" },
  { path: "/features", priority: "0.9", changefreq: "monthly" },
  { path: "/pricing", priority: "0.9", changefreq: "monthly" },
  { path: "/developers", priority: "0.8", changefreq: "monthly" },
  { path: "/about", priority: "0.7", changefreq: "monthly" },
  { path: "/blog", priority: "0.8", changefreq: "weekly" },
  { path: "/contact", priority: "0.6", changefreq: "yearly" },
  { path: "/privacy", priority: "0.3", changefreq: "yearly" },
  { path: "/terms", priority: "0.3", changefreq: "yearly" },
];

/** Dynamic sitemap: static pages plus every published article. */
export async function sitemap(ctx: Ctx): Promise<Response> {
  const base = (ctx.env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
  const posts = await all<{ slug: string; updated_at: string }>(
    ctx.env.DB,
    `SELECT slug, updated_at FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC`,
  );

  const url = (loc: string, lastmod: string, priority: string, changefreq: string) =>
    `  <url><loc>${escapeHtml(`${base}${loc}`)}</loc><lastmod>${lastmod}</lastmod><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;

  const today = new Date().toISOString().slice(0, 10);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC_ROUTES.map((route) => url(route.path, today, route.priority, route.changefreq)),
    ...posts.map((post) => url(`/blog/${post.slug}`, post.updated_at.slice(0, 10), "0.6", "monthly")),
    "</urlset>",
    "",
  ].join("\n");

  return xml(body);
}

// ---------------------------------------------------------------------------
// Public share access
// ---------------------------------------------------------------------------

interface ShareContext {
  share: ShareRow;
  file: FileRow;
  owner: UserRow;
}

async function loadShare(ctx: Ctx, token: string): Promise<ShareContext> {
  const share = await first<ShareRow>(ctx.env.DB, `SELECT * FROM shares WHERE token = ?`, token);
  if (!share || share.revoked_at) throw notFound("This link is no longer available.");

  if (share.expires_at && new Date(share.expires_at).getTime() < Date.now()) {
    throw new ApiError("not_found", "This link has expired.");
  }

  const file = await first<FileRow>(ctx.env.DB, `SELECT * FROM files WHERE id = ?`, share.file_id);
  if (!file || file.trashed_at) throw notFound("This link is no longer available.");

  const owner = await first<UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, share.owner_id);
  if (!owner || owner.status !== "active") throw notFound("This link is no longer available.");

  return { share, file, owner };
}

function unlockCookieName(token: string): string {
  return `cg_share_${token.slice(0, 12)}`;
}

async function requireUnlocked(ctx: Ctx, share: ShareRow, token: string): Promise<void> {
  if (!share.password_hash) return;
  const cookies = parseCookies(ctx.req.headers.get("cookie"));
  const value = cookies[unlockCookieName(token)];
  if (!value) throw unauthorized("This link is password protected.");
  const decoded = await readSignedValue<{ t: string }>(value, ctx.env.SESSION_SECRET || "insecure-development-secret");
  if (!decoded || decoded.t !== token) throw unauthorized("This link is password protected.");
}

async function touchShare(ctx: Ctx, share: ShareRow, options: { countView?: boolean; countDownload?: boolean } = {}): Promise<void> {
  await run(
    ctx.env.DB,
    `UPDATE shares SET view_count = view_count + ?, download_count = download_count + ?, last_accessed_at = ? WHERE id = ?`,
    options.countView ? 1 : 0,
    options.countDownload ? 1 : 0,
    nowIso(),
    share.id,
  );
  if (options.countDownload) {
    await run(
      ctx.env.DB,
      `UPDATE files SET last_accessed_at = ? WHERE id = ?`,
      nowIso(),
      share.file_id,
    );
  }
}

/** Metadata for a shared item: what it is, who shared it and whether it is locked. */
export async function shareMetadata(ctx: Ctx): Promise<Response> {
  const token = ctx.params.token;
  const { share, file, owner } = await loadShare(ctx, token);

  const cookies = parseCookies(ctx.req.headers.get("cookie"));
  const unlocked = share.password_hash
    ? Boolean(await readSignedValue<{ t: string }>(cookies[unlockCookieName(token)] ?? "", ctx.env.SESSION_SECRET || "insecure-development-secret"))
    : true;

  let children: ReturnType<typeof toFileDto>[] = [];
  if (file.is_folder && unlocked) {
    const rows = await all<FileRow>(
      ctx.env.DB,
      `SELECT * FROM files WHERE parent_id = ? AND trashed_at IS NULL ORDER BY is_folder DESC, name COLLATE NOCASE LIMIT 500`,
      file.id,
    );
    children = rows.map(toFileDto);
  }

  if (unlocked) await touchShare(ctx, share, { countView: true });

  return json({
    share: {
      id: share.id,
      kind: share.recipient_email ? "email" : "link",
      permission: share.permission,
      hasPassword: Boolean(share.password_hash),
      unlocked,
      expiresAt: share.expires_at,
      downloadCount: share.download_count,
      maxDownloads: share.max_downloads,
      ownerName: owner.display_name ?? owner.email.split("@")[0],
    },
    file: toFileDto(file),
    children,
  });
}

export async function shareUnlock(ctx: Ctx): Promise<Response> {
  const token = ctx.params.token;
  const { share } = await loadShare(ctx, token);

  const limit = await consumeRateLimit(ctx.env, {
    scope: "share_unlock",
    limit: 10,
    windowSeconds: 900,
    identifier: `${token.slice(0, 12)}:${clientIp(ctx.req)}`,
  });
  if (!limit.allowed) {
    throw new ApiError("rate_limited", "Too many attempts on this link. Please try again later.", { retryAfter: 900 });
  }

  if (!share.password_hash) return json({ ok: true, unlocked: true });

  const input = readBody(await ctx.req.json().catch(() => ({})));
  const password = requireString(input, "password", { label: "Password", max: 200 });

  let stored: PasswordHash | null = null;
  try {
    stored = JSON.parse(share.password_hash) as PasswordHash;
  } catch {
    stored = null;
  }
  if (!stored) throw new ApiError("internal_error", "This link cannot be unlocked right now.");

  const valid = await verifyPassword(password, stored);
  if (!valid) throw unauthorized("That password is not correct.");

  const value = await createSignedValue({ t: token }, ctx.env.SESSION_SECRET || "insecure-development-secret", 3600);
  return json(
    { ok: true, unlocked: true },
    {
      headers: {
        "set-cookie": serializeCookie(unlockCookieName(token), value, {
          maxAge: 3600,
          httpOnly: true,
          secure: cookieSecure(ctx.env, ctx.url),
          sameSite: "Lax",
          path: "/",
        }),
      },
    },
  );
}

export async function shareDownload(ctx: Ctx): Promise<Response> {
  const token = ctx.params.token;
  const { share, file } = await loadShare(ctx, token);
  await requireUnlocked(ctx, share, token);

  if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
    throw new ApiError("forbidden", "This link has reached its download limit.");
  }

  const childId = ctx.url.searchParams.get("fileId");

  if (file.is_folder) {
    const target = childId ? await first<FileRow>(ctx.env.DB, `SELECT * FROM files WHERE id = ? AND trashed_at IS NULL`, childId) : null;
    if (target) {
      const inside = target.path === file.path || target.path.startsWith(`${file.path}/`);
      if (!inside || target.user_id !== file.user_id) throw notFound("That file is not part of this share.");
      if (target.is_folder) {
        const children = await descendants(ctx.env, target.user_id, target);
        const response = await folderZipResponse(ctx.env, target, children, target.name);
        await touchShare(ctx, share, { countDownload: true });
        return response;
      }
      if (!target.storage_key) throw new ApiError("conflict", "That file lives in a connected drive and cannot be downloaded from this link.");
      const response = await streamStoredFile(ctx.env, target, { disposition: "attachment" });
      await touchShare(ctx, share, { countDownload: true });
      return response;
    }

    const children = await descendants(ctx.env, file.user_id, file);
    const response = await folderZipResponse(ctx.env, file, children, file.name);
    await touchShare(ctx, share, { countDownload: true });
    return response;
  }

  if (!file.storage_key) {
    throw new ApiError("conflict", "This file lives in a connected drive and cannot be downloaded from this link.");
  }

  const rangeHeader = ctx.req.headers.get("range");
  const range = rangeHeader ? parseByteRange(rangeHeader, file.size) : null;
  const response = await streamStoredFile(ctx.env, file, { range: range ?? undefined, disposition: "attachment" });
  await touchShare(ctx, share, { countDownload: true });
  return response;
}

export async function sharePreview(ctx: Ctx): Promise<Response> {
  const token = ctx.params.token;
  const { share, file } = await loadShare(ctx, token);
  await requireUnlocked(ctx, share, token);

  if (file.is_folder) throw badRequest("Folders cannot be previewed. Download the folder instead.");
  if (!file.storage_key) throw new ApiError("conflict", "This file lives in a connected drive and has not been imported yet.");

  const safe = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/|audio\/|text\/plain|application\/pdf)/.test((file.mime_type ?? "").toLowerCase());
  const rangeHeader = ctx.req.headers.get("range");
  const range = rangeHeader ? parseByteRange(rangeHeader, file.size) : null;

  const response = await streamStoredFile(ctx.env, file, {
    range: range ?? undefined,
    disposition: safe ? "inline" : "attachment",
    cacheSeconds: 60,
  });
  await touchShare(ctx, share, { countView: true });
  return response;
}

/** Local copy so public share downloads do not depend on the developer API. */
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

export const settingsHelpers = { numericSetting, booleanSetting, hashPassword };
