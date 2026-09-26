/** Public contact form, newsletter sign-up and the admin-side inbox. */
import { Router } from "../core/router";
import { requireAdmin, requireUser } from "../core/context";
import { all, count, first, run } from "../core/db";
import { badRequest, clientIp, json, noContent, notFound, readJson, userAgent } from "../core/http";
import { audit, systemAudit } from "../core/audit";
import { deliver, sendEmail, templates } from "../core/email";
import { notifyAdmins } from "../core/notify";
import { id, normalizeEmail, now } from "../core/util";
import { optionalString, requireEmail, requireEnum, requireString } from "../core/validate";
import { pageParams, paged } from "../core/db";

export const contactRoutes = new Router();

export const CONTACT_TOPICS = ["general", "support", "sales", "billing", "security", "partnership", "press"] as const;
const CONTACT_STATUSES = ["new", "open", "resolved", "spam"] as const;

async function verifyTurnstile(secret: string | undefined, token: unknown, ip: string): Promise<boolean> {
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  body.append("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const payload = (await response.json().catch(() => ({ success: false }))) as { success?: boolean };
  return Boolean(payload.success);
}

/* -------------------------------------------------------------- public */

contactRoutes.post("/api/contact", async (ctx) => {
  const payload = await readJson<Record<string, unknown>>(ctx.request);
  const ip = clientIp(ctx.request);

  if (!(await verifyTurnstile(ctx.env.TURNSTILE_SECRET_KEY, payload.turnstile_token, ip))) {
    throw badRequest("Bot check failed. Please reload the page and try again.", "captcha_failed");
  }
  // Honeypot: real users never fill a hidden field.
  if (typeof payload.company === "string" && payload.company.trim()) {
    return json({ ok: true });
  }

  const name = requireString(payload.name, "Name", { min: 2, max: 120 });
  const email = requireEmail(payload.email);
  const subject = requireString(payload.subject, "Subject", { min: 3, max: 200 });
  const message = requireString(payload.message, "Message", { min: 10, max: 5000 });
  const topic = payload.topic ? requireEnum(payload.topic, CONTACT_TOPICS, "Topic") : "general";

  const messageId = id();
  await run(
    ctx.env,
    `INSERT INTO contact_messages(id, user_id, name, email, subject, topic, message, ip_address, user_agent)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    messageId,
    ctx.user?.id ?? null,
    name,
    email,
    subject,
    topic,
    message,
    ip,
    userAgent(ctx.request),
  );

  const support = ctx.env.SUPPORT_EMAIL || ctx.env.ADMIN_EMAIL;
  if (support) {
    ctx.waitUntil(
      deliver(ctx.env, {
        to: support,
        replyTo: email,
        ...templates.contactNotification(ctx.env, name, email, subject, message, topic),
      }).then(() => undefined, () => undefined),
    );
  }
  ctx.waitUntil(
    sendEmail(ctx.env, { to: email, ...templates.contactAcknowledgement(ctx.env, name, subject) }).then(
      () => undefined,
      () => undefined,
    ),
  );
  ctx.waitUntil(
    notifyAdmins(ctx.env, {
      type: "system.announcement",
      title: `New ${topic} enquiry`,
      body: `${name} <${email}>: ${subject}`,
      link: "/admin/inbox",
    }).then(() => undefined, () => undefined),
  );
  await systemAudit(ctx.env, "contact.received", { topic, email });

  return json({ ok: true, id: messageId, message: "Thanks — we'll reply within one business day." }, 201);
}, {
  maintenanceSafe: true,
  rateLimit: { limit: 5, windowSeconds: 3600, by: "ip" },
  summary: "Submit the public contact form",
});

contactRoutes.post("/api/newsletter", async (ctx) => {
  const payload = await readJson<{ email?: unknown; source?: unknown }>(ctx.request);
  const email = requireEmail(payload.email);
  const source = optionalString(payload.source, "Source", 60) || "website";
  await run(
    ctx.env,
    `INSERT INTO newsletter_subscribers(id, email, source, confirmed_at) VALUES(?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET unsubscribed_at = NULL, source = excluded.source`,
    id(),
    normalizeEmail(email),
    source,
    now(),
  );
  return json({ ok: true, message: "You're on the list." }, 201);
}, { maintenanceSafe: true, rateLimit: { limit: 10, windowSeconds: 3600, by: "ip" }, summary: "Subscribe to the newsletter" });

contactRoutes.post("/api/newsletter/unsubscribe", async (ctx) => {
  const payload = await readJson<{ email?: unknown }>(ctx.request);
  const email = requireEmail(payload.email);
  await run(ctx.env, "UPDATE newsletter_subscribers SET unsubscribed_at = ? WHERE email = ?", now(), normalizeEmail(email));
  return json({ ok: true });
}, { maintenanceSafe: true, rateLimit: { limit: 10, windowSeconds: 3600, by: "ip" } });

/* ---------------------------------------------------------- my tickets */

contactRoutes.get("/api/contact/mine", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(
    ctx.env,
    "SELECT id, subject, topic, status, message, reply, replied_at, created_at FROM contact_messages WHERE user_id = ? OR email = ? ORDER BY created_at DESC LIMIT 50",
    user.id,
    user.email,
  );
  return json({ messages: rows });
}, { auth: true, summary: "List enquiries submitted by the signed-in user" });

/* --------------------------------------------------------------- admin */

contactRoutes.get("/api/admin/contact", async (ctx) => {
  requireAdmin(ctx);
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 25, 100);
  const status = url.searchParams.get("status");
  const where = status && CONTACT_STATUSES.includes(status as (typeof CONTACT_STATUSES)[number]) ? "WHERE status = ?" : "";
  const args = where ? [status] : [];
  const total = await count(ctx.env, `SELECT COUNT(*) AS total FROM contact_messages ${where}`, ...args);
  const rows = await all(
    ctx.env,
    `SELECT * FROM contact_messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    ...args,
    params.limit,
    params.offset,
  );
  return json(paged(rows, total, params));
}, { admin: true, summary: "Admin: list contact enquiries" });

contactRoutes.patch("/api/admin/contact/:id", async (ctx) => {
  const admin = requireAdmin(ctx);
  const payload = await readJson<{ status?: unknown; reply?: unknown; assigned_to?: unknown }>(ctx.request);
  const message = await first<{ id: string; email: string; name: string; subject: string }>(
    ctx.env,
    "SELECT id, email, name, subject FROM contact_messages WHERE id = ?",
    ctx.params.id,
  );
  if (!message) throw notFound("Enquiry not found.", "message_not_found");

  const updates: string[] = [];
  const args: unknown[] = [];
  if (payload.status !== undefined) {
    updates.push("status = ?");
    args.push(requireEnum(payload.status, CONTACT_STATUSES, "Status"));
  }
  if (payload.assigned_to !== undefined) {
    updates.push("assigned_to = ?");
    args.push(payload.assigned_to === null ? null : String(payload.assigned_to));
  }

  let replyBody: string | null = null;
  if (payload.reply !== undefined && payload.reply !== null && String(payload.reply).trim()) {
    replyBody = requireString(payload.reply, "Reply", { min: 2, max: 5000 });
    updates.push("reply = ?", "replied_at = ?", "status = ?");
    args.push(replyBody, now(), "resolved");
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");

  args.push(ctx.params.id);
  await run(ctx.env, `UPDATE contact_messages SET ${updates.join(", ")} WHERE id = ?`, ...args);

  if (replyBody) {
    await deliver(ctx.env, {
      to: message.email,
      replyTo: ctx.env.SUPPORT_EMAIL || undefined,
      subject: `Re: ${message.subject}`,
      html: `<p>Hi ${message.name.split(" ")[0] || "there"},</p><p>${replyBody.replace(/\n/g, "<br>")}</p><p>— ${admin.display_name}, CloudGather support</p>`,
    }).catch(() => undefined);
  }

  await audit(ctx, { action: "admin.contact_updated", resourceType: "contact_message", resourceId: ctx.params.id });
  const updated = await first(ctx.env, "SELECT * FROM contact_messages WHERE id = ?", ctx.params.id);
  return json({ message: updated });
}, { admin: true, summary: "Admin: reply to or triage an enquiry" });

contactRoutes.delete("/api/admin/contact/:id", async (ctx) => {
  requireAdmin(ctx);
  await run(ctx.env, "DELETE FROM contact_messages WHERE id = ?", ctx.params.id);
  await audit(ctx, { action: "admin.contact_deleted", resourceType: "contact_message", resourceId: ctx.params.id });
  return noContent();
}, { admin: true });

contactRoutes.get("/api/admin/newsletter", async (ctx) => {
  requireAdmin(ctx);
  const url = new URL(ctx.request.url);
  const params = pageParams(url, 50, 500);
  const total = await count(ctx.env, "SELECT COUNT(*) AS total FROM newsletter_subscribers WHERE unsubscribed_at IS NULL");
  const rows = await all(
    ctx.env,
    "SELECT id, email, source, confirmed_at, created_at FROM newsletter_subscribers WHERE unsubscribed_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?",
    params.limit,
    params.offset,
  );
  return json(paged(rows, total, params));
}, { admin: true });
