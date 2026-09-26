/** Administrator console: metrics, user management, settings, audit, announcements. */
import { Router } from "../core/router";
import { loadUserByEmail, publicUser, requireAdmin } from "../core/context";
import { all, count, first, pageParams, paged, run } from "../core/db";
import { badRequest, conflict, forbidden, json, noContent, notFound, readJson } from "../core/http";
import { audit } from "../core/audit";
import { DEFAULT_SETTINGS, SETTING_DESCRIPTIONS, getSettings, setSettings, type SystemSettings } from "../core/settings";
import { deliver, templates } from "../core/email";
import { notify } from "../core/notify";
import { getUsage } from "../core/entitlements";
import { randomToken, sha256Hex } from "../core/crypto";
import { purgeUser } from "../core/purge";
import { id, inDays, inMinutes, likeEscape, now, parseJson } from "../core/util";
import { optionalIsoDate, optionalString, requireEmail, requireEnum, requireString } from "../core/validate";
import { appUrl } from "../env";
import { PLANS } from "../billing/plans";

export const adminRoutes = new Router();

const ROLES = ["user", "admin"] as const;
const STATUSES = ["active", "suspended", "pending_deletion"] as const;
const PLAN_IDS = PLANS.map((plan) => plan.id) as unknown as readonly string[];

/* --------------------------------------------------------------- stats */

adminRoutes.get("/api/admin/stats", async (ctx) => {
  requireAdmin(ctx);

  const [users, files, providers, posts, storage, activeSessions, pendingEmails, failedWebhooks, openTickets, trashBytes, subs] =
    await Promise.all([
      count(ctx.env, "SELECT COUNT(*) AS total FROM users"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM files WHERE deleted_at IS NULL"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM storage_providers"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM blog_posts"),
      count(ctx.env, "SELECT COALESCE(SUM(size),0) AS total FROM files WHERE is_folder = 0 AND deleted_at IS NULL AND storage_kind = 'managed'"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM sessions WHERE revoked_at IS NULL AND datetime(expires_at) > datetime('now')"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM email_outbox WHERE status = 'pending'"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM webhook_deliveries WHERE status = 'failed' AND datetime(created_at) > datetime('now','-1 day')"),
      count(ctx.env, "SELECT COUNT(*) AS total FROM contact_messages WHERE status IN ('new','open')"),
      count(ctx.env, "SELECT COALESCE(SUM(size),0) AS total FROM files WHERE deleted_at IS NOT NULL"),
      all<{ plan: string; total: number }>(ctx.env, "SELECT plan, COUNT(*) AS total FROM users GROUP BY plan"),
    ]);

  const recentActivities = await all(
    ctx.env,
    "SELECT id, action, resource_type, severity, actor_email, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10",
  );
  const signupsByDay = await all<{ day: string; total: number }>(
    ctx.env,
    "SELECT substr(created_at,1,10) AS day, COUNT(*) AS total FROM users WHERE datetime(created_at) > datetime('now','-30 days') GROUP BY day ORDER BY day",
  );
  const uploadsByDay = await all<{ day: string; total: number; bytes: number }>(
    ctx.env,
    `SELECT substr(created_at,1,10) AS day, COUNT(*) AS total, COALESCE(SUM(size),0) AS bytes FROM files
      WHERE is_folder = 0 AND datetime(created_at) > datetime('now','-30 days') GROUP BY day ORDER BY day`,
  );

  let storageHealthy = true;
  try {
    await ctx.env.FILES.head("healthcheck");
  } catch {
    storageHealthy = false;
  }

  return json({
    // Legacy keys consumed by the existing admin dashboard.
    userCount: users,
    fileCount: files,
    providerCount: providers,
    blogCount: posts,
    recentActivities,
    degraded: !storageHealthy || pendingEmails > 50 || failedWebhooks > 25,
    // Extended metrics.
    metrics: {
      managed_storage_bytes: storage,
      trash_bytes: trashBytes,
      active_sessions: activeSessions,
      pending_emails: pendingEmails,
      failed_webhooks_24h: failedWebhooks,
      open_tickets: openTickets,
      plans: subs,
    },
    charts: { signups_by_day: signupsByDay, uploads_by_day: uploadsByDay },
    health: { database: true, storage: storageHealthy },
  });
}, { admin: true, summary: "Admin metrics overview" });

/* --------------------------------------------------------------- users */

adminRoutes.get("/api/admin/users", async (ctx) => {
  requireAdmin(ctx);
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 50, 200);
  const search = url.searchParams.get("search")?.trim();
  const role = url.searchParams.get("role");
  const status = url.searchParams.get("status");

  const clauses: string[] = [];
  const args: unknown[] = [];
  if (search) {
    clauses.push("(email LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')");
    const like = `%${likeEscape(search)}%`;
    args.push(like, like);
  }
  if (role && ROLES.includes(role as (typeof ROLES)[number])) {
    clauses.push("role = ?");
    args.push(role);
  }
  if (status && STATUSES.includes(status as (typeof STATUSES)[number])) {
    clauses.push("status = ?");
    args.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const total = await count(ctx.env, `SELECT COUNT(*) AS total FROM users ${where}`, ...args);
  const rows = await all(
    ctx.env,
    `SELECT u.id, u.email, u.display_name, u.role, u.status, u.plan, u.avatar_url, u.email_verified_at, u.last_login_at,
            u.created_at, u.totp_enabled_at, u.storage_quota_bytes,
            (SELECT COALESCE(SUM(size),0) FROM files f WHERE f.user_id = u.id AND f.is_folder = 0 AND f.deleted_at IS NULL AND f.storage_kind = 'managed') AS storage_bytes,
            (SELECT COUNT(*) FROM files f WHERE f.user_id = u.id AND f.is_folder = 0 AND f.deleted_at IS NULL) AS file_count
       FROM users u ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    ...args,
    params.limit,
    params.offset,
  );
  const admins = await all(ctx.env, "SELECT id, email, display_name, created_at FROM users WHERE role = 'admin' ORDER BY created_at");
  const page = paged(rows, total, params);
  return json({ users: page.items, admins, ...page });
}, { admin: true, summary: "Admin: search and list users" });

adminRoutes.get("/api/admin/users/:id", async (ctx) => {
  requireAdmin(ctx);
  const user = await first<Record<string, unknown>>(
    ctx.env,
    `SELECT id, email, display_name, role, status, plan, avatar_url, email_verified_at, last_login_at, created_at,
            totp_enabled_at, storage_quota_bytes, locale, timezone, marketing_opt_in, delete_requested_at, purge_at, stripe_customer_id
       FROM users WHERE id = ?`,
    ctx.params.id,
  );
  if (!user) throw notFound("User not found.", "user_not_found");
  const [usage, sessions, providers, activity, subscription] = await Promise.all([
    getUsage(ctx.env, ctx.params.id),
    all(ctx.env, "SELECT id, client, ip_address, location, last_seen_at, created_at, expires_at, revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", ctx.params.id),
    all(ctx.env, "SELECT id, provider_name, status, last_sync_at, last_error FROM storage_providers WHERE user_id = ?", ctx.params.id),
    all(ctx.env, "SELECT id, action, resource_type, severity, created_at FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 25", ctx.params.id),
    first(ctx.env, "SELECT * FROM subscriptions WHERE user_id = ?", ctx.params.id),
  ]);
  return json({ user, usage, sessions, providers, activity, subscription: subscription ?? null });
}, { admin: true, summary: "Admin: inspect a single user" });

adminRoutes.patch("/api/admin/users/:id", async (ctx) => {
  const admin = requireAdmin(ctx);
  const target = await first<{ id: string; role: string; email: string; status: string }>(
    ctx.env,
    "SELECT id, role, email, status FROM users WHERE id = ?",
    ctx.params.id,
  );
  if (!target) throw notFound("User not found.", "user_not_found");
  const payload = await readJson<Record<string, unknown>>(ctx.request);

  const updates: string[] = [];
  const args: unknown[] = [];
  const set = (column: string, value: unknown) => {
    updates.push(`${column} = ?`);
    args.push(value);
  };

  if (payload.role !== undefined) {
    const role = requireEnum(payload.role, ROLES, "Role");
    if (target.id === admin.id && role !== "admin") {
      const adminCount = await count(ctx.env, "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
      if (adminCount <= 1) throw conflict("You are the last administrator — promote someone else first.", "last_admin");
    }
    set("role", role);
  }
  if (payload.status !== undefined) {
    const status = requireEnum(payload.status, STATUSES, "Status");
    if (target.id === admin.id && status !== "active") throw forbidden("You cannot suspend your own account.", "self_suspend");
    set("status", status);
    if (status === "suspended") {
      await run(ctx.env, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", now(), target.id);
    }
    if (status === "active") {
      set("delete_requested_at", null);
      set("purge_at", null);
      set("locked_until", null);
      set("failed_login_count", 0);
    }
  }
  if (payload.plan !== undefined) set("plan", requireEnum(payload.plan, PLAN_IDS, "Plan"));
  if (payload.display_name !== undefined) set("display_name", requireString(payload.display_name, "Display name", { min: 1, max: 80 }));
  if (payload.storage_quota_bytes !== undefined) {
    const quota = payload.storage_quota_bytes === null ? null : Number(payload.storage_quota_bytes);
    if (quota !== null && (!Number.isFinite(quota) || quota < 0)) throw badRequest("Quota must be a positive number of bytes.", "invalid_quota");
    set("storage_quota_bytes", quota);
  }
  if (payload.email_verified !== undefined) set("email_verified_at", payload.email_verified ? now() : null);
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");

  set("updated_at", now());
  args.push(target.id);
  await run(ctx.env, `UPDATE users SET ${updates.join(", ")} WHERE id = ?`, ...args);
  await audit(ctx, {
    action: "admin.user_updated",
    resourceType: "user",
    resourceId: target.id,
    severity: "warning",
    details: { fields: Object.keys(payload), target: target.email },
  });
  const updated = await first(ctx.env, "SELECT id, email, display_name, role, status, plan, storage_quota_bytes, email_verified_at FROM users WHERE id = ?", target.id);
  return json({ user: updated });
}, { admin: true, summary: "Admin: update role, status, plan or quota" });

/** Legacy endpoint kept for the existing admin console. */
adminRoutes.post("/api/admin/users/role", async (ctx) => {
  const admin = requireAdmin(ctx);
  const payload = await readJson<{ email?: unknown; role?: unknown }>(ctx.request);
  const email = requireEmail(payload.email);
  const role = requireEnum(payload.role, ROLES, "Role");
  const target = await loadUserByEmail(ctx.env, email);
  if (!target) throw notFound("No account with that email address.", "user_not_found");
  if (target.id === admin.id && role !== "admin") {
    const adminCount = await count(ctx.env, "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");
    if (adminCount <= 1) throw conflict("You are the last administrator — promote someone else first.", "last_admin");
  }
  await run(ctx.env, "UPDATE users SET role = ?, updated_at = ? WHERE id = ?", role, now(), target.id);
  await audit(ctx, { action: "admin.role_changed", resourceType: "user", resourceId: target.id, severity: "warning", details: { email, role } });
  await notify(ctx.env, {
    userId: target.id,
    type: "system.announcement",
    title: role === "admin" ? "You are now an administrator" : "Administrator access removed",
    body: `Your account role was changed to ${role}.`,
  });
  return json({ ok: true, user: publicUser({ ...target, role }) });
}, { admin: true, summary: "Admin: grant or revoke administrator access" });

adminRoutes.post("/api/admin/users/:id/password-reset", async (ctx) => {
  requireAdmin(ctx);
  const target = await first<{ id: string; email: string }>(ctx.env, "SELECT id, email FROM users WHERE id = ?", ctx.params.id);
  if (!target) throw notFound("User not found.", "user_not_found");
  const token = randomToken(24);
  await run(
    ctx.env,
    "INSERT INTO password_reset_tokens(id, user_id, token_hash, expires_at) VALUES(?, ?, ?, ?)",
    id(),
    target.id,
    await sha256Hex(token),
    inMinutes(60),
  );
  const link = `${appUrl(ctx.env)}/reset-password?token=${token}`;
  await deliver(ctx.env, { to: target.email, ...templates.passwordReset(ctx.env, link) });
  await audit(ctx, { action: "admin.password_reset_sent", resourceType: "user", resourceId: target.id, severity: "warning" });
  return json({ ok: true });
}, { admin: true, summary: "Admin: email a password reset link" });

adminRoutes.post("/api/admin/users/:id/sessions/revoke", async (ctx) => {
  requireAdmin(ctx);
  const result = await run(ctx.env, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", now(), ctx.params.id);
  await audit(ctx, { action: "admin.sessions_revoked", resourceType: "user", resourceId: ctx.params.id, severity: "warning" });
  return json({ ok: true, revoked: result.meta.changes ?? 0 });
}, { admin: true });

adminRoutes.delete("/api/admin/users/:id", async (ctx) => {
  const admin = requireAdmin(ctx);
  if (ctx.params.id === admin.id) throw forbidden("Delete your own account from account settings instead.", "self_delete");
  const target = await first<{ id: string; email: string }>(ctx.env, "SELECT id, email FROM users WHERE id = ?", ctx.params.id);
  if (!target) throw notFound("User not found.", "user_not_found");

  const immediate = new URL(ctx.request.url).searchParams.get("purge") === "1";
  if (immediate) {
    await purgeUser(ctx.env, target.id);
    await audit(ctx, { action: "admin.user_purged", resourceType: "user", resourceId: target.id, severity: "critical", details: { email: target.email } });
    return json({ ok: true, purged: true });
  }

  const purgeAt = inDays(7);
  await run(
    ctx.env,
    "UPDATE users SET status = 'pending_deletion', delete_requested_at = ?, purge_at = ?, updated_at = ? WHERE id = ?",
    now(),
    purgeAt,
    now(),
    target.id,
  );
  await run(ctx.env, "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", now(), target.id);
  await audit(ctx, { action: "admin.user_deletion_scheduled", resourceType: "user", resourceId: target.id, severity: "critical", details: { purge_at: purgeAt } });
  return json({ ok: true, purge_at: purgeAt });
}, { admin: true, summary: "Admin: schedule or force account deletion" });

/* ------------------------------------------------------------ settings */

adminRoutes.get("/api/admin/settings", async (ctx) => {
  requireAdmin(ctx);
  const settings = await getSettings(ctx.env);
  const rows = (Object.keys(DEFAULT_SETTINGS) as (keyof SystemSettings)[]).map((key) => ({
    id: key,
    setting_key: key,
    setting_value: settings[key],
    description: SETTING_DESCRIPTIONS[key],
    default_value: DEFAULT_SETTINGS[key],
  }));
  return json({ settings: rows });
}, { admin: true, maintenanceSafe: true, summary: "Admin: read runtime settings" });

adminRoutes.patch("/api/admin/settings", async (ctx) => {
  requireAdmin(ctx);
  const payload = await readJson<{ changes?: { key?: unknown; value?: unknown }[] }>(ctx.request);
  if (!Array.isArray(payload.changes) || !payload.changes.length) throw badRequest("Provide a `changes` array.", "no_changes");
  const allowed = new Set(Object.keys(DEFAULT_SETTINGS));
  const changes = payload.changes.map((change) => {
    const key = String(change.key ?? "");
    if (!allowed.has(key)) throw badRequest(`Unknown setting "${key}".`, "unknown_setting");
    return { key, value: change.value };
  });
  await setSettings(ctx.env, changes);
  await audit(ctx, { action: "admin.settings_updated", severity: "warning", details: { keys: changes.map((change) => change.key) } });
  const settings = await getSettings(ctx.env);
  return json({ ok: true, settings });
}, { admin: true, maintenanceSafe: true, summary: "Admin: update runtime settings" });

/* --------------------------------------------------------------- audit */

adminRoutes.get("/api/admin/audit", async (ctx) => {
  requireAdmin(ctx);
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 50, 200);
  const clauses: string[] = [];
  const args: unknown[] = [];
  const action = url.searchParams.get("action");
  const userId = url.searchParams.get("user_id");
  const severity = url.searchParams.get("severity");
  if (action) {
    clauses.push("action LIKE ? ESCAPE '\\'");
    args.push(`${likeEscape(action)}%`);
  }
  if (userId) {
    clauses.push("user_id = ?");
    args.push(userId);
  }
  if (severity) {
    clauses.push("severity = ?");
    args.push(severity);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const total = await count(ctx.env, `SELECT COUNT(*) AS total FROM audit_logs ${where}`, ...args);
  const rows = await all(
    ctx.env,
    `SELECT id, user_id, actor_email, action, resource_type, resource_id, details, severity, ip_address, created_at
       FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...args,
    params.limit,
    params.offset,
  );
  return json(paged(rows.map((row) => ({ ...row, details: parseJson(row.details as string, {}) })), total, params));
}, { admin: true, summary: "Admin: search the audit trail" });

/* ------------------------------------------------------- announcements */

adminRoutes.get("/api/admin/announcements", async (ctx) => {
  requireAdmin(ctx);
  const rows = await all(ctx.env, "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100");
  return json({ announcements: rows });
}, { admin: true });

adminRoutes.post("/api/admin/announcements", async (ctx) => {
  const admin = requireAdmin(ctx);
  const payload = await readJson<Record<string, unknown>>(ctx.request);
  const title = requireString(payload.title, "Title", { min: 3, max: 160 });
  const body = requireString(payload.body, "Body", { min: 3, max: 4000 });
  const level = payload.level ? requireEnum(payload.level, ["info", "success", "warning", "critical"] as const, "Level") : "info";
  const audience = payload.audience ? requireEnum(payload.audience, ["all", "free", "paid", "admins"] as const, "Audience") : "all";
  const announcementId = id();
  await run(
    ctx.env,
    "INSERT INTO announcements(id, title, body, level, audience, starts_at, ends_at, published, created_by) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)",
    announcementId,
    title,
    body,
    level,
    audience,
    optionalIsoDate(payload.starts_at, "Start date"),
    optionalIsoDate(payload.ends_at, "End date"),
    payload.published ? 1 : 0,
    admin.id,
  );
  await audit(ctx, { action: "admin.announcement_created", resourceType: "announcement", resourceId: announcementId });
  const created = await first(ctx.env, "SELECT * FROM announcements WHERE id = ?", announcementId);
  return json({ announcement: created }, 201);
}, { admin: true, summary: "Admin: publish a banner announcement" });

adminRoutes.patch("/api/admin/announcements/:id", async (ctx) => {
  requireAdmin(ctx);
  const payload = await readJson<Record<string, unknown>>(ctx.request);
  const updates: string[] = [];
  const args: unknown[] = [];
  if (payload.title !== undefined) { updates.push("title = ?"); args.push(requireString(payload.title, "Title", { min: 3, max: 160 })); }
  if (payload.body !== undefined) { updates.push("body = ?"); args.push(requireString(payload.body, "Body", { min: 3, max: 4000 })); }
  if (payload.level !== undefined) { updates.push("level = ?"); args.push(requireEnum(payload.level, ["info", "success", "warning", "critical"] as const, "Level")); }
  if (payload.audience !== undefined) { updates.push("audience = ?"); args.push(requireEnum(payload.audience, ["all", "free", "paid", "admins"] as const, "Audience")); }
  if (payload.starts_at !== undefined) { updates.push("starts_at = ?"); args.push(optionalIsoDate(payload.starts_at, "Start date")); }
  if (payload.ends_at !== undefined) { updates.push("ends_at = ?"); args.push(optionalIsoDate(payload.ends_at, "End date")); }
  if (payload.published !== undefined) { updates.push("published = ?"); args.push(payload.published ? 1 : 0); }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");
  args.push(ctx.params.id);
  await run(ctx.env, `UPDATE announcements SET ${updates.join(", ")} WHERE id = ?`, ...args);
  const updated = await first(ctx.env, "SELECT * FROM announcements WHERE id = ?", ctx.params.id);
  if (!updated) throw notFound("Announcement not found.", "announcement_not_found");
  return json({ announcement: updated });
}, { admin: true });

adminRoutes.delete("/api/admin/announcements/:id", async (ctx) => {
  requireAdmin(ctx);
  await run(ctx.env, "DELETE FROM announcements WHERE id = ?", ctx.params.id);
  return noContent();
}, { admin: true });

adminRoutes.post("/api/admin/announcements/:id/broadcast", async (ctx) => {
  requireAdmin(ctx);
  const announcement = await first<{ id: string; title: string; body: string; audience: string }>(
    ctx.env,
    "SELECT id, title, body, audience FROM announcements WHERE id = ?",
    ctx.params.id,
  );
  if (!announcement) throw notFound("Announcement not found.", "announcement_not_found");

  const where =
    announcement.audience === "admins" ? "WHERE role = 'admin'"
    : announcement.audience === "paid" ? "WHERE plan != 'free'"
    : announcement.audience === "free" ? "WHERE plan = 'free'"
    : "";
  const recipients = await all<{ id: string }>(ctx.env, `SELECT id FROM users ${where ? `${where} AND` : "WHERE"} status = 'active' LIMIT 5000`);
  let delivered = 0;
  for (const recipient of recipients) {
    await notify(ctx.env, {
      userId: recipient.id,
      type: "system.announcement",
      title: announcement.title,
      body: announcement.body,
      email: templates.announcement(ctx.env, announcement.title, announcement.body),
    }).then(() => { delivered += 1; }, () => undefined);
  }
  await audit(ctx, { action: "admin.announcement_broadcast", resourceType: "announcement", resourceId: announcement.id, details: { delivered } });
  return json({ ok: true, delivered });
}, { admin: true, summary: "Admin: push an announcement to users" });

/* ---------------------------------------------------------- operations */

adminRoutes.get("/api/admin/email-outbox", async (ctx) => {
  requireAdmin(ctx);
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 50, 200);
  const status = url.searchParams.get("status") || "pending";
  const total = await count(ctx.env, "SELECT COUNT(*) AS total FROM email_outbox WHERE status = ?", status);
  const rows = await all(
    ctx.env,
    "SELECT id, to_email, subject, status, attempts, provider, last_error, sent_at, created_at FROM email_outbox WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
    status,
    params.limit,
    params.offset,
  );
  return json(paged(rows, total, params));
}, { admin: true });

adminRoutes.post("/api/admin/email-outbox/flush", async (ctx) => {
  requireAdmin(ctx);
  const { flushOutbox } = await import("../core/email");
  const result = await flushOutbox(ctx.env, 50);
  await audit(ctx, { action: "admin.outbox_flushed", details: result });
  return json(result);
}, { admin: true, summary: "Admin: retry queued email now" });

adminRoutes.get("/api/admin/storage", async (ctx) => {
  requireAdmin(ctx);
  const topUsers = await all(
    ctx.env,
    `SELECT u.id, u.email, u.plan, COALESCE(SUM(f.size),0) AS bytes, COUNT(f.id) AS files
       FROM users u LEFT JOIN files f ON f.user_id = u.id AND f.is_folder = 0 AND f.deleted_at IS NULL AND f.storage_kind = 'managed'
      GROUP BY u.id ORDER BY bytes DESC LIMIT 25`,
  );
  const byCategory = await all(
    ctx.env,
    `SELECT COALESCE(category,'other') AS category, COUNT(*) AS files, COALESCE(SUM(size),0) AS bytes
       FROM files WHERE is_folder = 0 AND deleted_at IS NULL GROUP BY 1 ORDER BY bytes DESC`,
  );
  const providers = await all(
    ctx.env,
    "SELECT provider_name, COUNT(*) AS connections, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors FROM storage_providers GROUP BY provider_name ORDER BY connections DESC",
  );
  return json({ top_users: topUsers, by_category: byCategory, providers });
}, { admin: true, summary: "Admin: storage consumption breakdown" });

adminRoutes.post("/api/admin/maintenance", async (ctx) => {
  requireAdmin(ctx);
  const payload = await readJson<{ enabled?: unknown; message?: unknown }>(ctx.request);
  const enabled = Boolean(payload.enabled);
  const changes: { key: string; value: unknown }[] = [{ key: "maintenance_mode", value: enabled }];
  const message = optionalString(payload.message, "Message", 500);
  if (message) changes.push({ key: "maintenance_message", value: message });
  await setSettings(ctx.env, changes);
  await audit(ctx, { action: "admin.maintenance_toggled", severity: "critical", details: { enabled } });
  return json({ ok: true, maintenance_mode: enabled });
}, { admin: true, maintenanceSafe: true, summary: "Admin: toggle maintenance mode" });

adminRoutes.post("/api/admin/cron/run", async (ctx) => {
  requireAdmin(ctx);
  const payload = await readJson<{ task?: unknown }>(ctx.request).catch(() => ({}) as { task?: unknown });
  const { runTask, TASKS } = await import("../cron/scheduled");
  const task = String(payload.task || "all");
  if (task !== "all" && !TASKS.includes(task as (typeof TASKS)[number])) {
    throw badRequest(`Unknown task. Valid tasks: ${TASKS.join(", ")}.`, "unknown_task");
  }
  const result = await runTask(ctx.env, task as "all");
  await audit(ctx, { action: "admin.cron_run", details: { task } });
  return json({ ok: true, task, result });
}, { admin: true, summary: "Admin: run a maintenance job on demand" });
