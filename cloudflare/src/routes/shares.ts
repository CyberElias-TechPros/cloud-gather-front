/**
 * Share links and recipient shares (the owner's side; public access lives in
 * `routes/public.ts`).
 *
 * A share is a random token plus real policy: expiry, optional password,
 * optional download cap, and instant revocation. `download_count` and
 * `view_count` are maintained on every public hit so the owner can see what a
 * link is actually doing.
 */

import { currentUser, requireScope } from "../lib/auth";
import { hashPassword } from "../lib/crypto";
import { all, first, newId, nowIso, run } from "../lib/db";
import { queueEmail, templates } from "../lib/email";
import { badRequest, created, forbidden, json, notFound, type Ctx } from "../lib/http";
import { record } from "../lib/events";
import { booleanSetting, getSettings, numericSetting } from "../lib/settings";
import { optionalEmail, optionalEnum, optionalInt, optionalString, queryValue } from "../lib/validate";
import { findFile } from "../lib/files";
import type { AuthUser, FileRow, ShareRow, UserRow } from "../types";

export function shareUrl(env: { APP_URL?: string }, token: string): string {
  const base = (env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
  return `${base}/s/${token}`;
}

interface ShareDto {
  id: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  isFolder: boolean;
  kind: "link" | "email";
  permission: "view" | "edit";
  recipientEmail: string | null;
  hasPassword: boolean;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  viewCount: number;
  lastAccessedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  url: string | null;
  expired: boolean;
  owner?: { email: string; name: string | null };
}

export function toShareDto(
  row: ShareRow & {
    file_name?: string;
    file_size?: number;
    is_folder?: number;
    owner_email?: string | null;
    owner_name?: string | null;
  },
  appUrl: string,
): ShareDto {
  const kind: "link" | "email" = row.recipient_email ? "email" : "link";
  const expired = Boolean(row.expires_at && new Date(row.expires_at).getTime() < Date.now());
  return {
    id: row.id,
    fileId: row.file_id,
    fileName: row.file_name ?? "Unknown file",
    fileSize: row.file_size ?? 0,
    isFolder: Boolean(row.is_folder),
    kind,
    permission: row.permission,
    recipientEmail: row.recipient_email,
    hasPassword: Boolean(row.password_hash),
    expiresAt: row.expires_at,
    maxDownloads: row.max_downloads,
    downloadCount: row.download_count,
    viewCount: row.view_count,
    lastAccessedAt: row.last_accessed_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    url: row.revoked_at ? null : shareUrl({ APP_URL: appUrl }, row.token),
    expired,
    owner: row.owner_email ? { email: row.owner_email, name: row.owner_name ?? null } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function create(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const auth = ctx.state.auth as AuthUser;
  requireScope(auth, "share");

  const settings = await getSettings(ctx.env);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const fileId = String(input.fileId ?? "");
  if (!fileId) throw badRequest("Choose a file or folder to share.");

  const file = await findFile(ctx.env, user.id, fileId);
  if (file.trashed_at) throw badRequest("Restore this item from the trash before sharing it.");

  const email = optionalEmail(input, "email");
  const kind = optionalEnum(input, "kind", ["link", "email"] as const) ?? (email ? "email" : "link");
  if (kind === "link" && !booleanSetting(settings, "allow_public_links", true)) {
    throw forbidden("Public links are disabled on this deployment. Share with a specific email address instead.");
  }
  if (kind === "email" && !email) throw badRequest("Add the recipient's email address.");

  const maxExpiryDays = numericSetting(settings, "max_share_expiry_days", 365);
  const defaultExpiryDays = numericSetting(settings, "share_default_expiry_days", 30);
  const requestedDays = optionalInt(input, "expiresInDays", { min: 1, max: maxExpiryDays, label: "Expiry" });
  const expiresInDays = kind === "link" ? (requestedDays ?? defaultExpiryDays) : requestedDays ?? null;

  const maxDownloads = optionalInt(input, "maxDownloads", { min: 1, max: 100_000, label: "Download limit" }) ?? null;
  const password = optionalString(input, "password", { max: 128 });
  const permission = optionalEnum(input, "permission", ["view", "edit"] as const) ?? "view";

  if (password) {
    const strength = password.length >= 8;
    if (!strength) throw badRequest("Choose a link password of at least 8 characters.");
  }

  let recipientUserId: string | null = null;
  if (email) {
    const recipient = await first<UserRow>(ctx.env.DB, `SELECT id FROM users WHERE email_normalized = ?`, email);
    recipientUserId = recipient?.id ?? null;
  }

  const passwordHash = password ? JSON.stringify(await hashPassword(password, 100_000)) : null;
  const id = newId("shr");
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null;

  await run(
    ctx.env.DB,
    `INSERT INTO shares (id, file_id, owner_id, token, recipient_email, recipient_user_id, permission, password_hash,
                         expires_at, max_downloads, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    file.id,
    user.id,
    token,
    email ?? null,
    recipientUserId,
    permission,
    passwordHash,
    expiresAt,
    maxDownloads,
    nowIso(),
  );

  await run(ctx.env.DB, `UPDATE files SET share_count = share_count + 1, updated_at = ? WHERE id = ?`, nowIso(), file.id);

  const url = shareUrl(ctx.env, token);

  if (email) {
    if (recipientUserId) {
      await run(
        ctx.env.DB,
        `INSERT INTO notifications (id, user_id, type, title, body, link, created_at) VALUES (?, ?, 'share_received', ?, ?, ?, ?)`,
        newId("ntf"),
        recipientUserId,
        `${user.display_name ?? user.email} shared "${file.name}" with you`,
        `Access is granted for ${permission === "edit" ? "editing" : "viewing"}.`,
        `/shared`,
        nowIso(),
      );
    }
    if (booleanSetting(settings, "notify_on_share", true)) {
      const template = templates.shareReceived(
        ctx.env.APP_NAME ?? "CloudGather",
        ctx.env.APP_URL ?? "",
        user.display_name ?? user.email,
        file.name,
        url,
        expiresAt,
      );
      await queueEmail(ctx.env, { to: email, subject: template.subject, html: template.html });
    }
  }

  await record(ctx.env, {
    action: "share.created",
    user,
    resourceType: "share",
    resourceId: id,
    ctx,
    details: { fileId: file.id, kind, permission, expiresAt },
    usage: { shares_created: 1 },
  });

  const row = await first<ShareRow>(ctx.env.DB, `SELECT * FROM shares WHERE id = ?`, id);
  return created({
    share: toShareDto({ ...(row as ShareRow), file_name: file.name, file_size: file.size, is_folder: file.is_folder }, ctx.env.APP_URL ?? ""),
    url,
    token,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function list(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const fileId = queryValue(ctx.url, "fileId");
  const includeRevoked = queryValue(ctx.url, "includeRevoked") === "true";
  const limit = Math.min(Number(queryValue(ctx.url, "limit") ?? 100) || 100, 500);

  const rows = await all<ShareRow & { file_name: string; file_size: number; is_folder: number }>(
    ctx.env.DB,
    `SELECT s.*, f.name AS file_name, f.size AS file_size, f.is_folder
       FROM shares s JOIN files f ON f.id = s.file_id
      WHERE s.owner_id = ? ${fileId ? "AND s.file_id = ?" : ""} ${includeRevoked ? "" : "AND s.revoked_at IS NULL"}
      ORDER BY s.created_at DESC LIMIT ?`,
    ...(fileId ? [user.id, fileId, limit] : [user.id, limit]),
  );

  return json({ shares: rows.map((row) => toShareDto(row, ctx.env.APP_URL ?? "")) });
}

export async function incoming(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const rows = await all<ShareRow & { file_name: string; file_size: number; is_folder: number; owner_email: string; owner_name: string | null }>(
    ctx.env.DB,
    `SELECT s.*, f.name AS file_name, f.size AS file_size, f.is_folder, u.email AS owner_email, u.display_name AS owner_name
       FROM shares s
       JOIN files f ON f.id = s.file_id
       JOIN users u ON u.id = s.owner_id
      WHERE s.revoked_at IS NULL
        AND (s.recipient_user_id = ? OR (s.recipient_email IS NOT NULL AND s.recipient_email = ?))
        AND f.trashed_at IS NULL
      ORDER BY s.created_at DESC LIMIT 200`,
    user.id,
    user.email_normalized,
  );

  return json({ shares: rows.map((row) => toShareDto(row, ctx.env.APP_URL ?? "")) });
}

// ---------------------------------------------------------------------------
// Update & revoke
// ---------------------------------------------------------------------------

export async function update(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const share = await first<ShareRow>(ctx.env.DB, `SELECT * FROM shares WHERE id = ? AND owner_id = ?`, ctx.params.id, user.id);
  if (!share) throw notFound("That share no longer exists.");
  if (share.revoked_at) throw badRequest("That share has been revoked.");

  const settings = await getSettings(ctx.env);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  const permission = optionalEnum(input, "permission", ["view", "edit"] as const);
  const maxDownloads = optionalInt(input, "maxDownloads", { min: 1, max: 100_000, label: "Download limit" });
  const expiresInDays = optionalInt(input, "expiresInDays", { min: 1, max: numericSetting(settings, "max_share_expiry_days", 365), label: "Expiry" });
  const clearPassword = input.password === null;
  const password = optionalString(input, "password", { max: 128 });

  const expiresAt = "expiresInDays" in input ? (expiresInDays ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString() : null) : share.expires_at;
  const passwordHash = clearPassword ? null : password ? JSON.stringify(await hashPassword(password, 100_000)) : share.password_hash;

  await run(
    ctx.env.DB,
    `UPDATE shares SET permission = ?, expires_at = ?, max_downloads = ?, password_hash = ? WHERE id = ?`,
    permission ?? share.permission,
    expiresAt,
    "maxDownloads" in input ? (maxDownloads ?? null) : share.max_downloads,
    passwordHash,
    share.id,
  );

  const updated = await first<ShareRow>(ctx.env.DB, `SELECT * FROM shares WHERE id = ?`, share.id);
  const file = await first<FileRow>(ctx.env.DB, `SELECT name, size, is_folder FROM files WHERE id = ?`, share.file_id);

  return json({
    share: toShareDto(
      { ...(updated as ShareRow), file_name: file?.name ?? "", file_size: file?.size ?? 0, is_folder: file?.is_folder ?? 0 },
      ctx.env.APP_URL ?? "",
    ),
  });
}

export async function revoke(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const share = await first<ShareRow>(ctx.env.DB, `SELECT * FROM shares WHERE id = ? AND owner_id = ?`, ctx.params.id, user.id);
  if (!share) throw notFound("That share no longer exists.");

  if (!share.revoked_at) {
    await run(ctx.env.DB, `UPDATE shares SET revoked_at = ? WHERE id = ?`, nowIso(), share.id);
    await run(
      ctx.env.DB,
      `UPDATE files SET share_count = MAX(0, share_count - 1) WHERE id = ?`,
      share.file_id,
    );
  }

  await record(ctx.env, { action: "share.revoked", user, resourceType: "share", resourceId: share.id, ctx });
  return json({ ok: true });
}

/** Housekeeping: flags expired links so the UI can show them as inactive. */
export async function expireOldShares(env: Ctx["env"]): Promise<number> {
  const result = await run(
    env.DB,
    `UPDATE shares SET revoked_at = ? WHERE revoked_at IS NULL AND expires_at IS NOT NULL AND expires_at < ?`,
    nowIso(),
    nowIso(),
  );
  return result.meta.changes ?? 0;
}

export const __testables = { toShareDto, shareUrl };
