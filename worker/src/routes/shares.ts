/** Sharing: per-recipient shares, public links and anonymous link access. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, count, first, pageParams, paged, run } from "../core/db";
import {
  badRequest,
  conflict,
  contentDisposition,
  forbidden,
  json,
  noContent,
  notFound,
  readJson,
  unauthorized,
} from "../core/http";
import { hmacSha256Hex, passwordHash, randomToken, sha256Hex, timingSafeEqual, verifyPassword } from "../core/crypto";
import { audit } from "../core/audit";
import { getEntitlements, hasCapability } from "../core/entitlements";
import { notify } from "../core/notify";
import { templates } from "../core/email";
import { dispatch } from "../core/webhooks";
import { assertWithinCount } from "../core/entitlements";
import { id, isEmail, normalizeEmail, now, toInt } from "../core/util";
import { optionalIsoDate, optionalString, requireEnum } from "../core/validate";
import { appUrl } from "../env";
import { getFile, publicFile, touchFile, type FileRow } from "./fileHelpers";
import { loadProviderRow, openConnection, requireAdapter } from "../providers";

export const shareRoutes = new Router();

const linkUrl = (env: Parameters<typeof appUrl>[0], token: string) => `${appUrl(env)}/s/${token}`;

/* ------------------------------------------------------- email shares */

shareRoutes.get("/api/files/:id/shares", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  const shares = await all(
    ctx.env,
    "SELECT * FROM file_shares WHERE file_id = ? AND owner_id = ? AND revoked_at IS NULL ORDER BY created_at DESC",
    file.id,
    user.id,
  );
  return json({ shares });
}, { auth: true, scope: "read" });

shareRoutes.post("/api/files/:id/shares", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id);
  const payload = await readJson<{ email: string; permission?: string; expires_at?: string | null; message?: string; notify?: boolean }>(ctx.request);
  const email = normalizeEmail(payload.email);
  if (!isEmail(email)) throw badRequest("Enter a valid email address.", "invalid_email");
  if (email === user.email) throw conflict("You already own this item.", "self_share");

  const permission = requireEnum(payload.permission ?? "view", ["view", "edit"] as const, "permission");
  const expiresAt = optionalIsoDate(payload.expires_at, "Expiry date");
  const message = optionalString(payload.message, "Message", 1000);

  const existing = await first<{ id: string }>(
    ctx.env,
    "SELECT id FROM file_shares WHERE file_id = ? AND shared_with_email = ? AND revoked_at IS NULL",
    file.id,
    email,
  );
  if (existing) throw conflict("This item is already shared with that address.", "already_shared");

  const recipient = await first<{ id: string }>(ctx.env, "SELECT id FROM users WHERE email = ? COLLATE NOCASE", email);
  const shareId = id();
  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO file_shares(id, file_id, owner_id, shared_with_email, shared_with_id, permission_level, expires_at, message)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(shareId, file.id, user.id, email, recipient?.id ?? null, permission, expiresAt, message),
    ctx.env.DB.prepare("UPDATE files SET is_shared = 1, updated_at = ? WHERE id = ?").bind(now(), file.id),
  ]);

  const share = await first(ctx.env, "SELECT * FROM file_shares WHERE id = ?", shareId);
  await audit(ctx, { action: "share.created", resourceType: "file", resourceId: file.id, details: { email, permission } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "share.created", { share_id: shareId, file_id: file.id, email, permission }));

  if (payload.notify !== false) {
    const template = templates.shareInvite(
      ctx.env,
      user.display_name || user.email,
      file.filename,
      `${appUrl(ctx.env)}/shared`,
      message,
      permission,
    );
    if (recipient) {
      ctx.waitUntil(
        notify(ctx.env, {
          userId: recipient.id,
          type: "share.received",
          title: `${user.display_name || user.email} shared "${file.filename}"`,
          body: message || undefined,
          link: "/shared",
          email: template,
        }),
      );
    } else {
      const { sendEmail } = await import("../core/email");
      ctx.waitUntil(sendEmail(ctx.env, { to: email, subject: template.subject, html: template.html, tag: "share-invite" }).then(() => undefined));
    }
  }

  return json({ share }, 201);
}, { auth: true, scope: "share", verified: true, summary: "Share an item with someone by email" });

shareRoutes.patch("/api/shares/:id", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ permission?: string; expires_at?: string | null }>(ctx.request);
  const share = await first<{ id: string; file_id: string }>(
    ctx.env,
    "SELECT id, file_id FROM file_shares WHERE id = ? AND owner_id = ?",
    ctx.params.id,
    user.id,
  );
  if (!share) throw notFound("Share not found.", "share_not_found");
  const updates: string[] = [];
  const args: unknown[] = [];
  if (payload.permission !== undefined) {
    updates.push("permission_level = ?");
    args.push(requireEnum(payload.permission, ["view", "edit"] as const, "permission"));
  }
  if (payload.expires_at !== undefined) {
    updates.push("expires_at = ?");
    args.push(optionalIsoDate(payload.expires_at, "Expiry date"));
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");
  await run(ctx.env, `UPDATE file_shares SET ${updates.join(", ")} WHERE id = ?`, ...args, share.id);
  return json({ share: await first(ctx.env, "SELECT * FROM file_shares WHERE id = ?", share.id) });
}, { auth: true, scope: "share" });

shareRoutes.delete("/api/shares/:id", async (ctx) => {
  const user = requireUser(ctx);
  const share = await first<{ id: string; file_id: string; shared_with_email: string; shared_with_id: string | null }>(
    ctx.env,
    "SELECT id, file_id, shared_with_email, shared_with_id FROM file_shares WHERE id = ? AND owner_id = ?",
    ctx.params.id,
    user.id,
  );
  if (!share) throw notFound("Share not found.", "share_not_found");

  await run(ctx.env, "DELETE FROM file_shares WHERE id = ?", share.id);
  const remaining = await count(ctx.env, "SELECT count(*) AS value FROM file_shares WHERE file_id = ? AND revoked_at IS NULL", share.file_id);
  const links = await count(ctx.env, "SELECT count(*) AS value FROM public_links WHERE file_id = ? AND revoked_at IS NULL", share.file_id);
  if (!remaining && !links) await run(ctx.env, "UPDATE files SET is_shared = 0 WHERE id = ?", share.file_id);

  await audit(ctx, { action: "share.revoked", resourceType: "file", resourceId: share.file_id, details: { email: share.shared_with_email } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "share.revoked", { share_id: share.id, file_id: share.file_id }));
  if (share.shared_with_id) {
    const file = await first<{ filename: string }>(ctx.env, "SELECT filename FROM files WHERE id = ?", share.file_id);
    ctx.waitUntil(
      notify(ctx.env, {
        userId: share.shared_with_id,
        type: "share.revoked",
        title: `Access removed: ${file?.filename ?? "an item"}`,
        link: "/shared",
        email: templates.shareRevoked(ctx.env, file?.filename ?? "an item"),
      }),
    );
  }
  return noContent();
}, { auth: true, scope: "share" });

shareRoutes.get("/api/shares/sent", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(
    ctx.env,
    `SELECT s.*, f.filename, f.is_folder, f.size, f.mime_type
       FROM file_shares s JOIN files f ON f.id = s.file_id
      WHERE s.owner_id = ? AND s.revoked_at IS NULL ORDER BY s.created_at DESC LIMIT 200`,
    user.id,
  );
  return json({ shares: rows });
}, { auth: true, scope: "read" });

shareRoutes.get("/api/shares/received", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(
    ctx.env,
    `SELECT s.id, s.file_id, s.permission_level, s.expires_at, s.created_at, s.message,
            f.filename, f.is_folder, f.size, f.mime_type, f.updated_at,
            u.display_name AS owner_name, u.email AS owner_email
       FROM file_shares s
       JOIN files f ON f.id = s.file_id
       JOIN users u ON u.id = s.owner_id
      WHERE (s.shared_with_email = ? COLLATE NOCASE OR s.shared_with_id = ?)
        AND s.revoked_at IS NULL AND f.deleted_at IS NULL
        AND (s.expires_at IS NULL OR datetime(s.expires_at) > datetime('now'))
      ORDER BY s.created_at DESC LIMIT 200`,
    user.email,
    user.id,
  );
  return json({ shares: rows });
}, { auth: true, scope: "read", summary: "Items shared with me" });

/** Recipient download for an email share. */
shareRoutes.get("/api/shares/:id/download", async (ctx) => {
  const user = requireUser(ctx);
  const share = await first<{ id: string; file_id: string; owner_id: string; expires_at: string | null }>(
    ctx.env,
    `SELECT id, file_id, owner_id, expires_at FROM file_shares
      WHERE id = ? AND revoked_at IS NULL AND (shared_with_email = ? COLLATE NOCASE OR shared_with_id = ?)`,
    ctx.params.id,
    user.email,
    user.id,
  );
  if (!share) throw notFound("Share not found.", "share_not_found");
  if (share.expires_at && share.expires_at < now()) throw forbidden("This share has expired.", "share_expired");

  const file = await first<FileRow>(ctx.env, "SELECT * FROM files WHERE id = ? AND deleted_at IS NULL", share.file_id);
  if (!file) throw notFound("The shared item is no longer available.", "file_not_found");
  await run(ctx.env, "UPDATE file_shares SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?", now(), share.id);
  return streamFile(ctx.env, file, false);
}, { auth: true, scope: "read" });

/* -------------------------------------------------------- public links */

shareRoutes.post("/api/files/:id/links", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id);
  const entitlements = await getEntitlements(ctx.env, user);
  if (!hasCapability(entitlements, "public_links")) throw forbidden("Public links are disabled for your account.", "public_links_disabled");
  assertWithinCount(entitlements.usage.publicLinkCount, entitlements.limits.maxPublicLinks, "public link", entitlements.plan.name);

  const payload = await readJson<{
    password?: string | null; expires_at?: string | null; max_downloads?: number | null; allow_download?: boolean; note?: string | null;
  }>(ctx.request).catch(() => ({}) as Record<string, never>);

  if (payload.password && !hasCapability(entitlements, "password_links")) {
    throw forbidden(`Password-protected links require the Pro plan or higher.`, "plan_upgrade_required");
  }

  const token = randomToken(18);
  const linkId = id();
  const salt = payload.password ? randomToken(16) : null;

  await ctx.env.DB.batch([
    ctx.env.DB.prepare(
      `INSERT INTO public_links(id, file_id, owner_id, token_hash, token_prefix, password_hash, password_salt, permission,
                                allow_download, max_downloads, expires_at, note)
       VALUES(?, ?, ?, ?, ?, ?, ?, 'view', ?, ?, ?, ?)`,
    ).bind(
      linkId,
      file.id,
      user.id,
      await sha256Hex(token),
      token.slice(0, 8),
      payload.password ? await passwordHash(String(payload.password), salt!) : null,
      salt,
      payload.allow_download === false ? 0 : 1,
      payload.max_downloads ? Math.max(1, toInt(payload.max_downloads, 0)) : null,
      optionalIsoDate(payload.expires_at, "Expiry date"),
      optionalString(payload.note, "Note", 200),
    ),
    ctx.env.DB.prepare("UPDATE files SET is_shared = 1, updated_at = ? WHERE id = ?").bind(now(), file.id),
  ]);

  await audit(ctx, { action: "link.created", resourceType: "file", resourceId: file.id, details: { link_id: linkId } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "link.created", { link_id: linkId, file_id: file.id }));
  const row = await first(ctx.env, "SELECT * FROM public_links WHERE id = ?", linkId);
  return json({ link: { ...(row as Record<string, unknown>), url: linkUrl(ctx.env, token), token }, warning: "Copy this URL now — the token is not shown again." }, 201);
}, { auth: true, scope: "share", verified: true, summary: "Create a public share link" });

shareRoutes.get("/api/files/:id/links", async (ctx) => {
  const user = requireUser(ctx);
  const file = await getFile(ctx.env, user.id, ctx.params.id, { includeTrashed: true });
  const rows = await all(
    ctx.env,
    `SELECT id, token_prefix, permission, allow_download, max_downloads, download_count, view_count, expires_at,
            revoked_at, last_accessed_at, note, created_at, (password_hash IS NOT NULL) AS has_password
       FROM public_links WHERE file_id = ? AND owner_id = ? ORDER BY created_at DESC`,
    file.id,
    user.id,
  );
  return json({ links: rows });
}, { auth: true, scope: "read" });

shareRoutes.get("/api/links", async (ctx) => {
  const user = requireUser(ctx);
  const params = pageParams(ctx.url, 50, 200);
  const rows = await all(
    ctx.env,
    `SELECT l.id, l.token_prefix, l.allow_download, l.max_downloads, l.download_count, l.view_count, l.expires_at,
            l.revoked_at, l.last_accessed_at, l.note, l.created_at, (l.password_hash IS NOT NULL) AS has_password,
            f.filename, f.is_folder, f.size, f.mime_type, f.id AS file_id
       FROM public_links l JOIN files f ON f.id = l.file_id
      WHERE l.owner_id = ? ORDER BY l.created_at DESC LIMIT ? OFFSET ?`,
    user.id,
    params.limit,
    params.offset,
  );
  const total = await count(ctx.env, "SELECT count(*) AS value FROM public_links WHERE owner_id = ?", user.id);
  return json({ links: rows, ...paged(rows, total, params) });
}, { auth: true, scope: "read", summary: "All public links I own" });

shareRoutes.patch("/api/links/:id", async (ctx) => {
  const user = requireUser(ctx);
  const link = await first<{ id: string }>(ctx.env, "SELECT id FROM public_links WHERE id = ? AND owner_id = ?", ctx.params.id, user.id);
  if (!link) throw notFound("Link not found.", "link_not_found");
  const payload = await readJson<{ expires_at?: string | null; max_downloads?: number | null; allow_download?: boolean; password?: string | null; note?: string | null }>(ctx.request);

  const updates: string[] = [];
  const args: unknown[] = [];
  if (payload.expires_at !== undefined) {
    updates.push("expires_at = ?");
    args.push(optionalIsoDate(payload.expires_at, "Expiry date"));
  }
  if (payload.max_downloads !== undefined) {
    updates.push("max_downloads = ?");
    args.push(payload.max_downloads ? Math.max(1, toInt(payload.max_downloads, 1)) : null);
  }
  if (payload.allow_download !== undefined) {
    updates.push("allow_download = ?");
    args.push(payload.allow_download ? 1 : 0);
  }
  if (payload.note !== undefined) {
    updates.push("note = ?");
    args.push(optionalString(payload.note, "Note", 200));
  }
  if (payload.password !== undefined) {
    if (payload.password) {
      const salt = randomToken(16);
      updates.push("password_hash = ?", "password_salt = ?");
      args.push(await passwordHash(String(payload.password), salt), salt);
    } else {
      updates.push("password_hash = NULL", "password_salt = NULL");
    }
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");
  await run(ctx.env, `UPDATE public_links SET ${updates.join(", ")} WHERE id = ?`, ...args, link.id);
  return json({ link: await first(ctx.env, "SELECT * FROM public_links WHERE id = ?", link.id) });
}, { auth: true, scope: "share" });

shareRoutes.delete("/api/links/:id", async (ctx) => {
  const user = requireUser(ctx);
  const link = await first<{ id: string; file_id: string }>(ctx.env, "SELECT id, file_id FROM public_links WHERE id = ? AND owner_id = ?", ctx.params.id, user.id);
  if (!link) throw notFound("Link not found.", "link_not_found");
  await run(ctx.env, "UPDATE public_links SET revoked_at = ? WHERE id = ?", now(), link.id);
  const remaining = await count(ctx.env, "SELECT count(*) AS value FROM public_links WHERE file_id = ? AND revoked_at IS NULL", link.file_id);
  const shares = await count(ctx.env, "SELECT count(*) AS value FROM file_shares WHERE file_id = ? AND revoked_at IS NULL", link.file_id);
  if (!remaining && !shares) await run(ctx.env, "UPDATE files SET is_shared = 0 WHERE id = ?", link.file_id);
  await audit(ctx, { action: "link.revoked", resourceType: "file", resourceId: link.file_id });
  ctx.waitUntil(dispatch(ctx.env, user.id, "link.revoked", { link_id: link.id, file_id: link.file_id }));
  return noContent();
}, { auth: true, scope: "share" });

shareRoutes.get("/api/links/:id/visits", async (ctx) => {
  const user = requireUser(ctx);
  const link = await first<{ id: string }>(ctx.env, "SELECT id FROM public_links WHERE id = ? AND owner_id = ?", ctx.params.id, user.id);
  if (!link) throw notFound("Link not found.", "link_not_found");
  const visits = await all(ctx.env, "SELECT action, country, referrer, created_at FROM public_link_visits WHERE link_id = ? ORDER BY created_at DESC LIMIT 200", link.id);
  return json({ visits });
}, { auth: true, scope: "read" });

/* ------------------------------------------------- anonymous link access */

interface LinkRow {
  id: string; file_id: string; owner_id: string; password_hash: string | null; password_salt: string | null;
  allow_download: number; max_downloads: number | null; download_count: number; expires_at: string | null;
  revoked_at: string | null; note: string | null;
}

async function loadLink(ctx: { env: import("../env").Env }, token: string): Promise<{ link: LinkRow; file: FileRow }> {
  const link = await first<LinkRow>(ctx.env, "SELECT * FROM public_links WHERE token_hash = ?", await sha256Hex(token));
  if (!link || link.revoked_at) throw notFound("This link is no longer active.", "link_inactive");
  if (link.expires_at && link.expires_at < now()) throw forbidden("This link has expired.", "link_expired");
  const file = await first<FileRow>(ctx.env, "SELECT * FROM files WHERE id = ? AND deleted_at IS NULL", link.file_id);
  if (!file) throw notFound("The shared item is no longer available.", "file_not_found");
  return { link, file };
}

/** Short-lived proof that a link password was entered correctly. */
async function issueAccessToken(env: import("../env").Env, linkId: string): Promise<string> {
  const expires = Date.now() + 30 * 60 * 1000;
  const secret = env.ENCRYPTION_KEY || env.ALLOWED_ORIGINS || "cloudgather";
  const signature = await hmacSha256Hex(secret, `${linkId}.${expires}`);
  return `${expires}.${signature}`;
}

async function verifyAccessToken(env: import("../env").Env, linkId: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  if (Number(expires) < Date.now()) return false;
  const secret = env.ENCRYPTION_KEY || env.ALLOWED_ORIGINS || "cloudgather";
  return timingSafeEqual(await hmacSha256Hex(secret, `${linkId}.${expires}`), signature);
}

shareRoutes.get("/api/public/links/:token", async (ctx) => {
  const { link, file } = await loadLink(ctx, ctx.params.token);
  const owner = await first<{ display_name: string }>(ctx.env, "SELECT display_name FROM users WHERE id = ?", link.owner_id);
  ctx.waitUntil(
    (async () => {
      await run(ctx.env, "UPDATE public_links SET view_count = view_count + 1, last_accessed_at = ? WHERE id = ?", now(), link.id);
      await run(
        ctx.env,
        "INSERT INTO public_link_visits(id, link_id, action, ip_hash, user_agent, country, referrer) VALUES(?, ?, 'view', ?, ?, ?, ?)",
        id(),
        link.id,
        await sha256Hex(ctx.ip),
        ctx.userAgent,
        (ctx.request as Request & { cf?: IncomingRequestCfProperties }).cf?.country ?? null,
        ctx.request.headers.get("referer"),
      );
    })(),
  );

  const requiresPassword = Boolean(link.password_hash);
  return json({
    link: {
      id: link.id,
      requires_password: requiresPassword,
      allow_download: Boolean(link.allow_download),
      downloads_remaining: link.max_downloads ? Math.max(0, link.max_downloads - link.download_count) : null,
      expires_at: link.expires_at,
      note: link.note,
    },
    file: requiresPassword
      ? { filename: file.filename, is_folder: Boolean(file.is_folder) }
      : { ...publicFile(file), user_id: undefined },
    owner: { display_name: owner?.display_name ?? "A CloudGather user" },
  });
}, { maintenanceSafe: true, rateLimit: { limit: 60, windowSeconds: 60 }, summary: "Public link metadata" });

shareRoutes.post("/api/public/links/:token/unlock", async (ctx) => {
  const { link, file } = await loadLink(ctx, ctx.params.token);
  const payload = await readJson<{ password: string }>(ctx.request);
  if (!link.password_hash || !link.password_salt) return json({ access_token: await issueAccessToken(ctx.env, link.id), file: publicFile(file) });
  const valid = await verifyPassword(String(payload.password || ""), link.password_salt, link.password_hash);
  if (!valid) throw unauthorized("That password is incorrect.", "invalid_link_password");
  return json({ access_token: await issueAccessToken(ctx.env, link.id), file: { ...publicFile(file), user_id: undefined } });
}, { maintenanceSafe: true, rateLimit: { limit: 20, windowSeconds: 300 } });

shareRoutes.get("/api/public/links/:token/download", async (ctx) => {
  const { link, file } = await loadLink(ctx, ctx.params.token);
  if (!link.allow_download) throw forbidden("Downloads are disabled for this link.", "download_disabled");
  if (link.password_hash && !(await verifyAccessToken(ctx.env, link.id, ctx.url.searchParams.get("access")))) {
    throw unauthorized("Unlock this link with its password first.", "password_required");
  }
  if (link.max_downloads && link.download_count >= link.max_downloads) {
    throw forbidden("This link has reached its download limit.", "download_limit_reached");
  }
  if (file.is_folder) throw badRequest("Folder links cannot be downloaded as a single file.", "folder_download");

  ctx.waitUntil(
    (async () => {
      await run(ctx.env, "UPDATE public_links SET download_count = download_count + 1, last_accessed_at = ? WHERE id = ?", now(), link.id);
      await run(ctx.env, "UPDATE files SET download_count = download_count + 1 WHERE id = ?", file.id);
      await run(
        ctx.env,
        "INSERT INTO public_link_visits(id, link_id, action, ip_hash, user_agent, country) VALUES(?, ?, 'download', ?, ?, ?)",
        id(),
        link.id,
        await sha256Hex(ctx.ip),
        ctx.userAgent,
        (ctx.request as Request & { cf?: IncomingRequestCfProperties }).cf?.country ?? null,
      );
      await dispatch(ctx.env, link.owner_id, "link.accessed", { link_id: link.id, file_id: file.id, action: "download" });
    })(),
  );

  return streamFile(ctx.env, file, ctx.url.searchParams.get("inline") === "1");
}, { maintenanceSafe: true, rateLimit: { limit: 60, windowSeconds: 300 } });

/** Streams managed (R2) or provider-backed content with the right headers. */
export async function streamFile(env: import("../env").Env, file: FileRow, inline: boolean): Promise<Response> {
  if (file.storage_kind === "provider" && file.provider_id) {
    const row = await loadProviderRow(env, file.user_id, file.provider_id);
    if (!row) throw notFound("The provider for this file is no longer connected.", "provider_missing");
    const adapter = requireAdapter(row.provider_name);
    const connection = await openConnection(env, row);
    const response = await adapter.download(connection, file.provider_file_id || file.id);
    return new Response(response.body, {
      headers: {
        "content-type": response.headers.get("content-type") || file.mime_type || "application/octet-stream",
        "content-disposition": contentDisposition(file.filename, inline),
      },
    });
  }
  if (!file.r2_key) throw notFound("This file has no stored content.", "content_missing");
  const object = await env.FILES.get(file.r2_key);
  if (!object) throw notFound("The stored object could not be found.", "content_missing");
  return new Response(object.body, {
    headers: {
      "content-type": file.mime_type || "application/octet-stream",
      "content-disposition": contentDisposition(file.filename, inline),
      "content-length": String(file.size),
      etag: object.httpEtag,
    },
  });
}

export { touchFile };
