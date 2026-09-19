/**
 * Sharing: named (email) shares, expiring public links, optional passwords,
 * download limits, and folder downloads streamed as ZIP.
 */

import type { RouteContext } from "../types";
import { Router } from "../lib/router";
import {
  HttpError,
  badRequest,
  clientIp,
  forbidden,
  json,
  notFound,
  readJson,
  serializeCookie,
  validationFailed,
} from "../lib/http";
import { v } from "../lib/validate";
import { loadSettings } from "../lib/settings";
import { requireAuth, requireScope, rateLimit } from "../middleware";
import { notify, recordAudit, recordUsage, sendEmail } from "../lib/events";
import { base64url, encryptSecret, randomToken, sha256Hex, signPayload, verifySignature } from "../lib/crypto";
import { checkPasswordStrength, hashPassword, verifyPassword } from "../lib/password";
import { FileRow, descendantIds, escapeLike, findFile, toFileDto } from "../lib/files";
import { parseRangeMaybe } from "./files";
import { createZipStream, safeZipPath } from "../lib/zip";
import { shareEmail } from "../lib/emailTemplates";

const createSchema = v.object({
  fileId: v.string({ min: 3, max: 64 }),
  kind: v.literal(["email", "link"] as const).default("link"),
  email: v.email().optional(),
  permission: v.literal(["view", "edit"] as const).default("view"),
  expiresInDays: v.int({ min: 0, max: 365 }).nullable().optional(),
  maxDownloads: v.int({ min: 1, max: 100000 }).nullable().optional(),
  password: v.string({ min: 6, max: 100 }).nullable().optional(),
});

const UNLOCK_COOKIE_TTL_SECONDS = 3600;

export function shareRoutes(router: Router): void {
  // ── Create ───────────────────────────────────────────────────────────────
  router.post("/api/shares", requireAuth, requireScope("share"), rateLimit("share-create", 60), async (ctx) => {
    const parsed = createSchema.parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);
    const { fileId, kind, email, permission } = parsed.value;

    if (kind === "email" && !email) throw validationFailed(["Enter the email address to share with"]);

    const file = await findFile(ctx.env, ctx.user!.id, fileId);
    if (file.trashed_at) throw badRequest("Restore this item before sharing it.");

    const now = new Date().toISOString();
    const expiresAt =
      parsed.value.expiresInDays && parsed.value.expiresInDays > 0
        ? new Date(Date.now() + parsed.value.expiresInDays * 86_400_000).toISOString()
        : null;

    let passwordHash: string | null = null;
    if (parsed.value.password) {
      const strength = checkPasswordStrength(parsed.value.password);
      if (!strength.valid) throw validationFailed(["Link password: " + strength.problems.join(", ")]);
      const hashed = await hashPassword(parsed.value.password);
      passwordHash = `${hashed.iterations}:${hashed.salt}:${hashed.hash}`;
    }

    const token = randomToken(24);
    const id = `shr_${token.slice(0, 12)}`;

    let recipientUserId: string | null = null;
    if (kind === "email" && email) {
      const recipient = await ctx.env.DB.prepare("SELECT id FROM users WHERE email_normalized = ?1").bind(email).first<{ id: string }>();
      recipientUserId = recipient?.id ?? null;
    }

    await ctx.env.DB.prepare(
      `INSERT INTO shares (id, file_id, owner_id, kind, recipient_email, recipient_user_id, permission, token, password_hash,
                           expires_at, max_downloads, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
      .bind(
        id,
        file.id,
        ctx.user!.id,
        kind,
        kind === "email" ? email ?? null : null,
        recipientUserId,
        permission,
        token,
        passwordHash,
        expiresAt,
        parsed.value.maxDownloads ?? null,
        now,
      )
      .run();

    const url = `${ctx.env.APP_URL}/s/${token}`;

    if (kind === "email" && email) {
      if (recipientUserId) {
        ctx.waitUntil(
          notify(ctx.env, recipientUserId, "share", `${ctx.user!.displayName ?? ctx.user!.email} shared "${file.name}" with you`, "Open Shared with me to view it.", "/shared"),
        );
      } else if (ctx.env.RESEND_API_KEY) {
        const settings = await loadSettings(ctx.env);
        const template = shareEmail(
          { appName: settings.app_name, appUrl: ctx.env.APP_URL, supportEmail: settings.support_email },
          ctx.user!.displayName ?? ctx.user!.email,
          file.name,
          url,
          expiresAt,
        );
        ctx.waitUntil(sendEmail(ctx.env, email, template.subject, template.html, template.text));
      }
    }

    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "share.created", resourceType: "share", resourceId: id, details: { file: file.name, kind, permission, email }, ip: clientIp(ctx.req) }));
    ctx.waitUntil(recordUsage(ctx.env, ctx.user!.id, { shares_created: 1 }));

    return json({ share: await shareDto(ctx, id), url, token }, { status: 201 });
  });

  // ── List ─────────────────────────────────────────────────────────────────
  router.get("/api/shares", requireAuth, async (ctx) => {
    const fileId = ctx.url.searchParams.get("fileId");
    const rows = await ctx.env.DB.prepare(
      `SELECT s.*, f.name AS file_name, f.size AS file_size, f.mime_type, f.is_folder
         FROM shares s JOIN files f ON f.id = s.file_id
        WHERE s.owner_id = ?1 AND s.revoked_at IS NULL ${fileId ? "AND s.file_id = ?2" : ""}
        ORDER BY s.created_at DESC LIMIT 200`,
    )
      .bind(...(fileId ? [ctx.user!.id, fileId] : [ctx.user!.id]))
      .all<Record<string, unknown> & { id: string; token: string | null }>();

    return json({
      shares: (rows.results ?? []).map((row) => ({
        id: row.id,
        fileId: row.file_id,
        fileName: row.file_name,
        fileSize: row.file_size,
        kind: row.kind,
        recipientEmail: row.recipient_email,
        permission: row.permission,
        url: row.token ? `${ctx.env.APP_URL}/s/${row.token}` : null,
        hasPassword: Boolean(row.password_hash),
        expiresAt: row.expires_at,
        maxDownloads: row.max_downloads,
        downloadCount: row.download_count,
        viewCount: row.view_count,
        lastAccessedAt: row.last_accessed_at,
        createdAt: row.created_at,
      })),
    });
  });

  /** Files other people have shared with the signed-in user. */
  router.get("/api/shares/incoming", requireAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare(
      `SELECT s.id, s.permission, s.created_at, s.expires_at, s.owner_id,
              f.id AS file_id, f.name, f.size, f.mime_type, f.is_folder, f.path, f.updated_at,
              u.email AS owner_email, u.display_name AS owner_name
         FROM shares s
         JOIN files f ON f.id = s.file_id
         JOIN users u ON u.id = s.owner_id
        WHERE s.revoked_at IS NULL AND s.kind = 'email' AND f.trashed_at IS NULL
          AND (s.recipient_user_id = ?1 OR lower(s.recipient_email) = (SELECT email_normalized FROM users WHERE id = ?1))
          AND (s.expires_at IS NULL OR s.expires_at > ?2)
        ORDER BY s.created_at DESC LIMIT 200`,
    )
      .bind(ctx.user!.id, new Date().toISOString())
      .all<Record<string, unknown>>();

    return json({
      shares: (rows.results ?? []).map((row) => ({
        id: row.id,
        fileId: row.file_id,
        name: row.name,
        size: row.size,
        mimeType: row.mime_type,
        isFolder: row.is_folder === 1,
        path: row.path,
        permission: row.permission,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        owner: { email: row.owner_email, name: row.owner_name },
      })),
    });
  });

  router.patch("/api/shares/:id", requireAuth, async (ctx) => {
    const parsed = v
      .object({
        permission: v.literal(["view", "edit"] as const).optional(),
        expiresInDays: v.int({ min: 0, max: 365 }).nullable().optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const share = await ctx.env.DB.prepare("SELECT id FROM shares WHERE id = ?1 AND owner_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<{ id: string }>();
    if (!share) throw notFound("That share no longer exists.");

    if (parsed.value.permission) {
      await ctx.env.DB.prepare("UPDATE shares SET permission = ?1 WHERE id = ?2").bind(parsed.value.permission, share.id).run();
    }
    if (parsed.value.expiresInDays !== undefined) {
      const expiresAt =
        parsed.value.expiresInDays && parsed.value.expiresInDays > 0
          ? new Date(Date.now() + parsed.value.expiresInDays * 86_400_000).toISOString()
          : null;
      await ctx.env.DB.prepare("UPDATE shares SET expires_at = ?1 WHERE id = ?2").bind(expiresAt, share.id).run();
    }
    return json({ share: await shareDto(ctx, share.id) });
  });

  router.delete("/api/shares/:id", requireAuth, async (ctx) => {
    const share = await ctx.env.DB.prepare("SELECT id, file_id FROM shares WHERE id = ?1 AND owner_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<{ id: string; file_id: string }>();
    if (!share) throw notFound("That share no longer exists.");

    await ctx.env.DB.prepare("UPDATE shares SET revoked_at = ?1 WHERE id = ?2").bind(new Date().toISOString(), share.id).run();
    // Share counts are derived from the shares table, never denormalised.
    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "share.revoked", resourceType: "share", resourceId: share.id }));
    return json({ ok: true });
  });

  // ── Public link endpoints (no session required) ──────────────────────────
  router.get("/api/public/shares/:token", rateLimit("share-view", 240), async (ctx) => {
    const share = await loadShare(ctx, ctx.params.token);
    const children = share.file.is_folder === 1 ? await listChildren(ctx, share.file) : [];
    return json({
      share: {
        id: share.row.id,
        kind: share.row.kind,
        permission: share.row.permission,
        hasPassword: Boolean(share.row.password_hash),
        unlocked: await isUnlocked(ctx, share.row.token!, share.row.password_hash),
        expiresAt: share.row.expires_at,
        downloadCount: share.row.download_count,
        maxDownloads: share.row.max_downloads,
        ownerName: share.ownerName,
      },
      file: toFileDto(share.file),
      children,
    });
  });

  router.post("/api/public/shares/:token/unlock", rateLimit("share-unlock", 20), async (ctx) => {
    const share = await loadShare(ctx, ctx.params.token);
    if (!share.row.password_hash) return json({ ok: true, unlocked: true });

    const parsed = v.object({ password: v.string({ min: 1, max: 100 }) }).parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const [iterations, salt, hash] = share.row.password_hash.split(":");
    const ok = await verifyPassword(parsed.value.password, {
      password_hash: hash,
      password_salt: salt,
      password_iterations: Number(iterations),
    });
    if (!ok) {
      await recordAudit(ctx.env, {
        userId: null,
        actorEmail: null,
        action: "share.unlock_failed",
        resourceType: "share",
        resourceId: share.row.id,
        ip: clientIp(ctx.req),
      });
      throw forbidden("That password is not correct.");
    }

    const signature = await signPayload(`share:${share.row.token}`, sessionSecret(ctx));
    const cookie = serializeCookie(unlockCookieName(share.row.token!), signature, {
      maxAge: UNLOCK_COOKIE_TTL_SECONDS,
      httpOnly: true,
      sameSite: "Lax",
      secure: ctx.url.protocol === "https:",
      path: "/",
    });
    return json({ ok: true, unlocked: true }, { headers: { "set-cookie": cookie } });
  });

  router.get("/api/public/shares/:token/download", rateLimit("share-download", 120), async (ctx) => {
    const share = await loadShare(ctx, ctx.params.token);
    const fileId = ctx.url.searchParams.get("fileId");
    let target = share.file;

    if (fileId) {
      if (share.file.is_folder !== 1) throw badRequest("This link points at a single file.");
      const descendant = await ctx.env.DB.prepare("SELECT * FROM files WHERE id = ?1 AND user_id = ?2 AND trashed_at IS NULL")
        .bind(fileId, share.file.user_id)
        .first<FileRow>();
      if (!descendant || !descendant.path.startsWith(share.file.path + "/")) {
        throw notFound("That file is not part of this share.");
      }
      target = descendant;
    }

    if (share.file.is_folder === 1 && !fileId) {
      await enforceDownloadBudget(ctx, share.row.id, share.row.max_downloads);
      const entries = await zipEntries(ctx, share.file);
      const stream = createZipStream(entries);
      await ctx.env.DB.prepare("UPDATE shares SET download_count = download_count + 1, last_accessed_at = ?1 WHERE id = ?2")
        .bind(new Date().toISOString(), share.row.id)
        .run();
      ctx.waitUntil(recordUsage(ctx.env, share.file.user_id, { downloads: 1 }));
      return new Response(stream, {
        headers: {
          "content-type": "application/zip",
          "content-disposition": `attachment; filename="${share.file.name.replace(/"/g, "")}.zip"`,
          "cache-control": "private, no-store",
        },
      });
    }

    await enforceDownloadBudget(ctx, share.row.id, share.row.max_downloads);
    await ctx.env.DB.prepare("UPDATE shares SET download_count = download_count + 1, last_accessed_at = ?1 WHERE id = ?2")
      .bind(new Date().toISOString(), share.row.id)
      .run();
    ctx.waitUntil(recordUsage(ctx.env, share.file.user_id, { downloads: 1, bytes_downloaded: target.size }));

    const range = parseRangeMaybe(ctx.req.headers.get("range"), target.size);
    const object = await ctx.env.FILES.get(
      target.storage_key!,
      range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined,
    );
    if (!object) throw notFound("That file is no longer available.");

    const headers = new Headers();
    headers.set("content-type", target.mime_type || "application/octet-stream");
    headers.set("accept-ranges", "bytes");
    headers.set("content-disposition", `attachment; filename="${target.name.replace(/"/g, "")}"`);
    headers.set("cache-control", "private, no-store");
    if (range) headers.set("content-range", `bytes ${range.start}-${range.end}/${target.size}`);
    return new Response(object.body, { status: range ? 206 : 200, headers });
  });

  router.get("/api/public/shares/:token/preview", rateLimit("share-preview", 240), async (ctx) => {
    const share = await loadShare(ctx, ctx.params.token);
    if (share.file.is_folder === 1) throw badRequest("Folders have no preview.");
    if (!share.file.storage_key) throw notFound("That file is not stored in CloudGather.");
    const object = await ctx.env.FILES.get(share.file.storage_key);
    if (!object) throw notFound("That file is no longer available.");
    return new Response(object.body, {
      headers: {
        "content-type": share.file.mime_type || "application/octet-stream",
        "content-disposition": `inline; filename="${share.file.name.replace(/"/g, "")}"`,
        "cache-control": "private, no-store",
      },
    });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface ShareRow {
  id: string;
  file_id: string;
  owner_id: string;
  kind: string;
  recipient_email: string | null;
  permission: string;
  token: string | null;
  password_hash: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  view_count: number;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function sessionSecret(ctx: RouteContext): string {
  return ctx.env.SESSION_SECRET || ctx.env.TOKEN_ENCRYPTION_KEY || "cloudgather-dev-secret";
}

function unlockCookieName(token: string): string {
  return `cg_unlock_${token.slice(0, 12)}`;
}

async function isUnlocked(ctx: RouteContext, token: string, passwordHash: string | null): Promise<boolean> {
  if (!passwordHash) return true;
  const cookies = (await import("../lib/http")).parseCookies(ctx.req.headers.get("cookie"));
  const value = cookies[unlockCookieName(token)];
  if (!value) return false;
  return verifySignature(`share:${token}`, value, sessionSecret(ctx));
}

async function loadShare(ctx: RouteContext, token: string) {
  if (!token || token.length < 10) throw notFound("This link is not valid.");
  const row = await ctx.env.DB.prepare("SELECT * FROM shares WHERE token = ?1").bind(token).first<ShareRow>();
  if (!row || row.revoked_at) throw notFound("This link has been revoked or does not exist.");
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw new HttpError(410, "This link has expired.", "share_expired");
  }
  const unlocked = await isUnlocked(ctx, token, row.password_hash);
  if (!unlocked && ctx.url.pathname.endsWith("/download")) {
    throw new HttpError(401, "This link is password protected.", "share_locked");
  }

  const file = await ctx.env.DB.prepare("SELECT * FROM files WHERE id = ?1").bind(row.file_id).first<FileRow>();
  if (!file || file.trashed_at) throw notFound("The shared item is no longer available.");

  const owner = await ctx.env.DB.prepare("SELECT display_name, email FROM users WHERE id = ?1")
    .bind(row.owner_id)
    .first<{ display_name: string | null; email: string }>();

  await ctx.env.DB.prepare("UPDATE shares SET view_count = view_count + 1, last_accessed_at = ?1 WHERE id = ?2")
    .bind(new Date().toISOString(), row.id)
    .run()
    .catch(() => undefined);

  return { row, file, ownerName: owner?.display_name ?? owner?.email ?? "A CloudGather user" };
}

async function listChildren(ctx: RouteContext, folder: FileRow) {
  const rows = await ctx.env.DB.prepare(
    `SELECT id, name, size, mime_type, is_folder, updated_at FROM files
      WHERE user_id = ?1 AND parent_folder_id = ?2 AND trashed_at IS NULL
      ORDER BY is_folder DESC, lower(name) ASC LIMIT 500`,
  )
    .bind(folder.user_id, folder.id)
    .all<{ id: string; name: string; size: number; mime_type: string | null; is_folder: number; updated_at: string }>();
  return (rows.results ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    size: row.size,
    mimeType: row.mime_type,
    isFolder: row.is_folder === 1,
    updatedAt: row.updated_at,
    kind: row.is_folder === 1 ? "folder" : classify(row.mime_type, row.name),
  }));
}

function classify(mime: string | null, name: string): string {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("text/")) return "text";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["doc", "docx", "pdf", "txt", "md", "rtf", "odt"].includes(ext)) return "document";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "spreadsheet";
  if (["ppt", "pptx", "odp"].includes(ext)) return "presentation";
  return "other";
}

async function zipEntries(ctx: RouteContext, folder: FileRow) {
  const rows = await ctx.env.DB.prepare(
    `SELECT id, name, path, size, storage_key FROM files
      WHERE user_id = ?1 AND is_folder = 0 AND storage_key IS NOT NULL AND trashed_at IS NULL
        AND path LIKE ?2 ESCAPE '\\' ORDER BY path ASC`,
  )
    .bind(folder.user_id, `${escapeLike(folder.path)}/%`)
    .all<{ id: string; name: string; path: string; size: number; storage_key: string }>();

  return (rows.results ?? []).map((row) => ({
    name: safeZipPath(row.path.replace(folder.path, "").replace(/^\//, "")) || row.name,
    size: row.size,
    open: async () => (await ctx.env.FILES.get(row.storage_key))?.body ?? null,
  }));
}

async function enforceDownloadBudget(ctx: RouteContext, shareId: string, maxDownloads: number | null): Promise<void> {
  if (!maxDownloads) return;
  const row = await ctx.env.DB.prepare("SELECT download_count FROM shares WHERE id = ?1").bind(shareId).first<{ download_count: number }>();
  if ((row?.download_count ?? 0) >= maxDownloads) {
    throw new HttpError(410, "This link has reached its download limit.", "download_limit_reached");
  }
}

async function shareDto(ctx: RouteContext, shareId: string) {
  const row = await ctx.env.DB.prepare(
    `SELECT s.*, f.name AS file_name FROM shares s JOIN files f ON f.id = s.file_id WHERE s.id = ?1`,
  )
    .bind(shareId)
    .first<ShareRow & { file_name: string }>();
  if (!row) throw notFound("That share no longer exists.");
  return {
    id: row.id,
    fileId: row.file_id,
    fileName: row.file_name,
    kind: row.kind,
    recipientEmail: row.recipient_email,
    permission: row.permission,
    url: row.token ? `${ctx.env.APP_URL}/s/${row.token}` : null,
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at,
    maxDownloads: row.max_downloads,
    downloadCount: row.download_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

export { isUnlocked };
export const __internal = { sha256Hex, encryptSecret, base64url, descendantIds };
