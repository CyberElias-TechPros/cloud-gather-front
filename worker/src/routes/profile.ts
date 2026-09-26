/** Profile, avatar, preferences, dashboard summary and account lifecycle. */
import { Router } from "../core/router";
import { loadUserById, publicUser, requireUser } from "../core/context";
import { all, first, run } from "../core/db";
import { badRequest, json, noContent, notFound, readJson, tooLarge, unprocessable } from "../core/http";
import { audit } from "../core/audit";
import { getEntitlements } from "../core/entitlements";
import { notify, readNotificationPreferences, unreadCount } from "../core/notify";
import { templates } from "../core/email";
import { verifyPassword } from "../core/crypto";
import { inDays, now } from "../core/util";
import { optionalString, optionalUrl, requireString } from "../core/validate";
import { apiUrl } from "../env";
import { stripeEnabled } from "../billing/stripe";

export const profileRoutes = new Router();

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/* ------------------------------------------------------------ profile */

profileRoutes.patch("/api/profile", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<Record<string, unknown>>(ctx.request);
  const updates: string[] = [];
  const args: unknown[] = [];

  if (payload.display_name !== undefined) {
    updates.push("display_name = ?");
    args.push(requireString(payload.display_name, "Display name", { min: 1, max: 80 }));
  }
  if (payload.avatar_url !== undefined) {
    updates.push("avatar_url = ?");
    args.push(payload.avatar_url === null ? null : optionalUrl(payload.avatar_url, "Avatar URL"));
  }
  if (payload.locale !== undefined) {
    updates.push("locale = ?");
    args.push(optionalString(payload.locale, "Locale", 12) || "en");
  }
  if (payload.timezone !== undefined) {
    updates.push("timezone = ?");
    args.push(optionalString(payload.timezone, "Timezone", 64));
  }
  if (payload.marketing_opt_in !== undefined) {
    updates.push("marketing_opt_in = ?");
    args.push(payload.marketing_opt_in ? 1 : 0);
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");

  updates.push("updated_at = ?");
  args.push(now(), user.id);
  await run(ctx.env, `UPDATE users SET ${updates.join(", ")} WHERE id = ?`, ...args);
  await audit(ctx, { action: "profile.updated", details: { fields: Object.keys(payload) } });

  const fresh = await loadUserById(ctx.env, user.id);
  return json({ user: fresh ? publicUser(fresh) : publicUser(user) });
}, { auth: true, scope: "write", summary: "Update profile fields" });

profileRoutes.post("/api/profile/avatar", async (ctx) => {
  const user = requireUser(ctx);
  const form = await ctx.request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw badRequest("Attach an image in the `file` field.", "file_required");
  if (file.size > AVATAR_MAX_BYTES) throw tooLarge("Avatars must be 2 MB or smaller.", "avatar_too_large");
  const type = file.type || "image/png";
  if (!AVATAR_TYPES.includes(type)) throw unprocessable("Avatars must be PNG, JPEG, WebP or GIF.", "unsupported_type");

  const key = `avatars/${user.id}`;
  await ctx.env.FILES.put(key, file.stream(), { httpMetadata: { contentType: type, cacheControl: "public, max-age=300" } });
  const url = `${apiUrl(ctx.env)}/users/${user.id}/avatar?v=${Date.now()}`;
  await run(ctx.env, "UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?", url, now(), user.id);
  await audit(ctx, { action: "profile.avatar_updated" });
  return json({ avatar_url: url });
}, { auth: true, scope: "write", rateLimit: { limit: 20, windowSeconds: 3600, by: "user" }, summary: "Upload an avatar image" });

profileRoutes.delete("/api/profile/avatar", async (ctx) => {
  const user = requireUser(ctx);
  await ctx.env.FILES.delete(`avatars/${user.id}`).catch(() => undefined);
  await run(ctx.env, "UPDATE users SET avatar_url = NULL, updated_at = ? WHERE id = ?", now(), user.id);
  return noContent();
}, { auth: true, scope: "write" });

profileRoutes.get("/api/users/:id/avatar", async (ctx) => {
  const object = await ctx.env.FILES.get(`avatars/${ctx.params.id}`);
  if (!object) throw notFound("No avatar set.", "avatar_not_found");
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType || "image/png",
      "cache-control": "public, max-age=300",
      etag: object.httpEtag,
    },
  });
}, { maintenanceSafe: true, summary: "Public avatar image" });

/* -------------------------------------------------------- preferences */

profileRoutes.get("/api/preferences", async (ctx) => {
  const user = requireUser(ctx);
  const settings = user.settings;
  return json({
    preferences: settings,
    notifications: readNotificationPreferences(settings),
  });
}, { auth: true });

profileRoutes.patch("/api/preferences", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<Record<string, unknown>>(ctx.request);
  const current = user.settings;
  const merged: Record<string, unknown> = { ...current, ...payload };
  // Notification preferences are a nested object — merge rather than replace.
  if (payload.notifications && typeof payload.notifications === "object") {
    merged.notifications = {
      ...readNotificationPreferences(current),
      ...(payload.notifications as Record<string, unknown>),
    };
  }
  await run(ctx.env, "UPDATE users SET settings = ?, updated_at = ? WHERE id = ?", JSON.stringify(merged), now(), user.id);
  return json({ preferences: merged, notifications: readNotificationPreferences(merged) });
}, { auth: true, scope: "write", summary: "Merge UI preferences into the user record" });

/* ---------------------------------------------------------- dashboard */

profileRoutes.get("/api/dashboard", async (ctx) => {
  const user = requireUser(ctx);
  const entitlements = await getEntitlements(ctx.env, user);

  const [recentFiles, recentActivity, providers, sharesIn, unread, announcement] = await Promise.all([
    all(
      ctx.env,
      `SELECT id, filename, filename AS name, mime_type, size, is_folder, category, updated_at, last_accessed_at, provider_id
         FROM files WHERE user_id = ? AND deleted_at IS NULL AND is_folder = 0
        ORDER BY COALESCE(last_accessed_at, updated_at) DESC LIMIT 8`,
      user.id,
    ),
    all(ctx.env, "SELECT id, action, resource_type, details, severity, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 8", user.id),
    all(ctx.env, "SELECT id, provider_name, display_name, provider_user_email, status, file_count, used_space, total_space, last_sync_at, last_error FROM storage_providers WHERE user_id = ? ORDER BY priority ASC", user.id),
    all(
      ctx.env,
      `SELECT s.id, s.permission_level, s.created_at, f.id AS file_id, f.filename, f.mime_type, f.size, u.display_name AS shared_by
         FROM file_shares s JOIN files f ON f.id = s.file_id JOIN users u ON u.id = s.owner_id
        WHERE s.shared_with_email = ? AND s.revoked_at IS NULL ORDER BY s.created_at DESC LIMIT 5`,
      user.email,
    ),
    unreadCount(ctx.env, user.id),
    first(ctx.env, `SELECT id, title, body, level FROM announcements WHERE published = 1
                      AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
                      AND (ends_at IS NULL OR datetime(ends_at) >= datetime('now'))
                    ORDER BY created_at DESC LIMIT 1`),
  ]);

  const byCategory = await all<{ category: string | null; total: number; bytes: number }>(
    ctx.env,
    `SELECT COALESCE(category, 'other') AS category, COUNT(*) AS total, COALESCE(SUM(size),0) AS bytes
       FROM files WHERE user_id = ? AND is_folder = 0 AND deleted_at IS NULL GROUP BY 1 ORDER BY bytes DESC`,
    user.id,
  );

  return json({
    user: publicUser(user),
    entitlements: {
      plan: entitlements.plan,
      limits: entitlements.limits,
      usage: entitlements.usage,
      storage_percent: entitlements.storagePercent,
      capabilities: entitlements.capabilities,
    },
    recent_files: recentFiles,
    recent_activity: recentActivity,
    providers,
    shared_with_me: sharesIn,
    unread_notifications: unread,
    announcement: announcement ?? null,
    categories: byCategory,
    onboarding_complete: Boolean(user.onboarded_at),
    billing_enabled: stripeEnabled(ctx.env),
  });
}, { auth: true, summary: "Aggregated dashboard payload" });

/* ----------------------------------------------------- account delete */

profileRoutes.delete("/api/account", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ password?: string; confirm?: string }>(ctx.request).catch(() => ({}) as { password?: string; confirm?: string });

  const row = await first<{ password_hash: string; password_salt: string }>(
    ctx.env,
    "SELECT password_hash, password_salt FROM users WHERE id = ?",
    user.id,
  );
  const hasPassword = Boolean(row?.password_hash);
  if (hasPassword) {
    if (!payload.password) throw badRequest("Enter your password to confirm account deletion.", "password_required");
    const ok = await verifyPassword(payload.password, row!.password_salt, row!.password_hash);
    if (!ok) throw badRequest("That password is not correct.", "invalid_password");
  }

  const graceDays = 30;
  const purgeAt = inDays(graceDays);
  await run(
    ctx.env,
    "UPDATE users SET status = 'pending_deletion', delete_requested_at = ?, purge_at = ?, updated_at = ? WHERE id = ?",
    now(),
    purgeAt,
    now(),
    user.id,
  );
  await run(ctx.env, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id != ?", now(), user.id, ctx.sessionId || "");

  if (stripeEnabled(ctx.env)) {
    const subscription = await first<{ provider_subscription_id: string | null }>(
      ctx.env,
      "SELECT provider_subscription_id FROM subscriptions WHERE user_id = ?",
      user.id,
    );
    if (subscription?.provider_subscription_id) {
      const { cancelSubscription } = await import("../billing/stripe");
      await cancelSubscription(ctx.env, subscription.provider_subscription_id, true).catch(() => undefined);
    }
  }

  await audit(ctx, { action: "account.deletion_requested", severity: "warning", details: { purge_at: purgeAt } });
  await notify(ctx.env, {
    userId: user.id,
    type: "account.deletion",
    title: "Account deletion scheduled",
    body: `Your data will be permanently removed on ${purgeAt.slice(0, 10)}. Sign in before then to cancel.`,
    email: templates.accountDeletionScheduled(ctx.env, purgeAt.slice(0, 10)),
    forceEmail: true,
  });

  return json({ ok: true, purge_at: purgeAt, grace_days: graceDays });
}, { auth: true, summary: "Schedule account deletion with a grace period" });

profileRoutes.post("/api/account/restore", async (ctx) => {
  const user = requireUser(ctx);
  if (user.status !== "pending_deletion") throw badRequest("This account is not scheduled for deletion.", "not_pending");
  await run(
    ctx.env,
    "UPDATE users SET status = 'active', delete_requested_at = NULL, purge_at = NULL, updated_at = ? WHERE id = ?",
    now(),
    user.id,
  );
  await audit(ctx, { action: "account.deletion_cancelled" });
  const fresh = await loadUserById(ctx.env, user.id);
  return json({ ok: true, user: fresh ? publicUser(fresh) : publicUser(user) });
}, { auth: true, summary: "Cancel a pending account deletion" });
