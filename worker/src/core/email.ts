/**
 * Transactional email with a provider-agnostic interface.
 *
 * Every message is persisted to `email_outbox` first, so nothing is silently
 * lost when no provider key is configured yet — the scheduled handler flushes
 * pending mail as soon as a key appears.
 */
import type { Env } from "../env";
import { appUrl, emailProvider } from "../env";
import { run, all } from "./db";
import { id, now } from "./util";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tag?: string;
  userId?: string | null;
}

export type EmailResult = { status: "sent" | "pending" | "failed"; error?: string; provider?: string };

const fromAddress = (env: Env) => {
  const email = env.FROM_EMAIL || "no-reply@cloudgather.app";
  const name = env.FROM_NAME || "CloudGather";
  return { email, name, formatted: `${name} <${email}>` };
};

export async function sendEmail(env: Env, message: EmailMessage): Promise<EmailResult> {
  const rowId = id();
  const text = message.text || htmlToText(message.html);
  await run(
    env,
    `INSERT INTO email_outbox(id, user_id, to_email, subject, html, text, tag, status, attempts)
     VALUES(?, ?, ?, ?, ?, ?, ?, 'pending', 0)`,
    rowId,
    message.userId ?? null,
    message.to,
    message.subject,
    message.html,
    text,
    message.tag ?? null,
  ).catch(() => undefined);

  const result = await deliver(env, { ...message, text });
  await run(
    env,
    `UPDATE email_outbox SET status = ?, attempts = attempts + 1, last_error = ?, provider = ?, sent_at = ?
      WHERE id = ?`,
    result.status === "sent" ? "sent" : "pending",
    result.error ?? null,
    result.provider ?? null,
    result.status === "sent" ? now() : null,
    rowId,
  ).catch(() => undefined);

  return result;
}

/** Performs the actual API call for the configured provider. */
export async function deliver(env: Env, message: EmailMessage): Promise<EmailResult> {
  const provider = emailProvider(env);
  const from = fromAddress(env);
  const replyTo = message.replyTo || env.SUPPORT_EMAIL;

  if (!provider) {
    return { status: "pending", error: "No email provider configured (set RESEND_API_KEY, POSTMARK_TOKEN or SENDGRID_API_KEY)." };
  }

  try {
    if (provider === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: from.formatted,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(message.tag ? { tags: [{ name: "category", value: message.tag }] } : {}),
        }),
      });
      if (!response.ok) return { status: "failed", provider, error: `resend ${response.status}: ${(await response.text()).slice(0, 300)}` };
      return { status: "sent", provider };
    }

    if (provider === "postmark") {
      const response = await fetch("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { "X-Postmark-Server-Token": env.POSTMARK_TOKEN!, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          From: from.formatted,
          To: message.to,
          Subject: message.subject,
          HtmlBody: message.html,
          TextBody: message.text,
          MessageStream: "outbound",
          ...(replyTo ? { ReplyTo: replyTo } : {}),
          ...(message.tag ? { Tag: message.tag } : {}),
        }),
      });
      if (!response.ok) return { status: "failed", provider, error: `postmark ${response.status}: ${(await response.text()).slice(0, 300)}` };
      return { status: "sent", provider };
    }

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { authorization: `Bearer ${env.SENDGRID_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: message.to }] }],
        from: { email: from.email, name: from.name },
        subject: message.subject,
        content: [
          { type: "text/plain", value: message.text || htmlToText(message.html) },
          { type: "text/html", value: message.html },
        ],
        ...(replyTo ? { reply_to: { email: replyTo } } : {}),
        ...(message.tag ? { categories: [message.tag] } : {}),
      }),
    });
    if (!response.ok) return { status: "failed", provider, error: `sendgrid ${response.status}: ${(await response.text()).slice(0, 300)}` };
    return { status: "sent", provider };
  } catch (error) {
    return { status: "failed", provider: provider || undefined, error: String(error).slice(0, 300) };
  }
}

/** Retries pending outbox rows — invoked by the scheduled handler. */
export async function flushOutbox(env: Env, limit = 25): Promise<{ sent: number; failed: number }> {
  if (!emailProvider(env)) return { sent: 0, failed: 0 };
  const rows = await all<{ id: string; to_email: string; subject: string; html: string; text: string; tag: string | null }>(
    env,
    `SELECT id, to_email, subject, html, text, tag FROM email_outbox
      WHERE status = 'pending' AND attempts < 6 ORDER BY created_at LIMIT ?`,
    limit,
  );
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await deliver(env, { to: row.to_email, subject: row.subject, html: row.html, text: row.text, tag: row.tag ?? undefined });
    if (result.status === "sent") sent += 1;
    else failed += 1;
    await run(
      env,
      `UPDATE email_outbox SET status = ?, attempts = attempts + 1, last_error = ?, provider = ?, sent_at = ? WHERE id = ?`,
      result.status === "sent" ? "sent" : "pending",
      result.error ?? null,
      result.provider ?? null,
      result.status === "sent" ? now() : null,
      row.id,
    );
  }
  return { sent, failed };
}

export function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr|li)>/gi, "\n")
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ *
 * Layout + templates
 * ------------------------------------------------------------------ */

interface LayoutOptions {
  title: string;
  preheader?: string;
  body: string;
  cta?: { label: string; url: string };
  footerNote?: string;
}

export function layout(env: Env, options: LayoutOptions): string {
  const base = appUrl(env);
  const brand = env.FROM_NAME || "CloudGather";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(options.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(options.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;border:1px solid #e2e8f0;overflow:hidden;">
<tr><td style="padding:28px 32px 8px;">
  <a href="${base}" style="text-decoration:none;color:#2563eb;font-size:18px;font-weight:700;">${escapeHtml(brand)}</a>
</td></tr>
<tr><td style="padding:8px 32px 0;">
  <h1 style="margin:0 0 12px;font-size:21px;line-height:1.3;font-weight:700;color:#0f172a;">${escapeHtml(options.title)}</h1>
  <div style="font-size:15px;line-height:1.6;color:#334155;">${options.body}</div>
</td></tr>
${
  options.cta
    ? `<tr><td style="padding:24px 32px 8px;">
  <a href="${options.cta.url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:9px;font-weight:600;font-size:15px;">${escapeHtml(options.cta.label)}</a>
  <p style="margin:16px 0 0;font-size:12px;color:#64748b;word-break:break-all;">Or paste this link into your browser:<br>${escapeHtml(options.cta.url)}</p>
</td></tr>`
    : ""
}
<tr><td style="padding:24px 32px 28px;">
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 16px;">
  <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
    ${options.footerNote ? `${escapeHtml(options.footerNote)}<br>` : ""}
    Sent by ${escapeHtml(brand)}. <a href="${base}/settings?tab=notifications" style="color:#2563eb;">Notification settings</a> ·
    <a href="${base}/privacy" style="color:#2563eb;">Privacy</a>
  </p>
</td></tr>
</table>
</td></tr></table></body></html>`;
}

export const templates = {
  verifyEmail: (env: Env, link: string, name: string) => ({
    subject: "Confirm your email address",
    html: layout(env, {
      title: `Welcome, ${escapeHtml(name)} 👋`,
      preheader: "Confirm your email to activate your CloudGather account.",
      body: `<p>Thanks for signing up. Confirm this address to activate your account and secure it for password recovery.</p><p>This link expires in 24 hours.</p>`,
      cta: { label: "Confirm email address", url: link },
      footerNote: "If you didn't create this account you can safely ignore this email.",
    }),
  }),

  welcome: (env: Env, name: string) => ({
    subject: "Your CloudGather account is ready",
    html: layout(env, {
      title: `You're all set, ${escapeHtml(name)}`,
      preheader: "Connect your first cloud provider to get started.",
      body: `<p>CloudGather gives you one home for every cloud. Here's the fastest path to value:</p>
        <ol style="padding-left:18px;margin:12px 0;">
          <li style="margin-bottom:6px;">Connect a provider (Google Drive, Dropbox, OneDrive, Box, S3…)</li>
          <li style="margin-bottom:6px;">Browse and search every account from one file list</li>
          <li>Share with expiring links and track every action in your activity log</li>
        </ol>`,
      cta: { label: "Open your dashboard", url: `${appUrl(env)}/dashboard` },
    }),
  }),

  passwordReset: (env: Env, link: string) => ({
    subject: "Reset your CloudGather password",
    html: layout(env, {
      title: "Reset your password",
      preheader: "This link expires in 60 minutes.",
      body: `<p>We received a request to reset your password. Choose a new one using the secure link below — it expires in 60 minutes and can be used once.</p>`,
      cta: { label: "Choose a new password", url: link },
      footerNote: "Didn't request this? Ignore this email; your password stays unchanged.",
    }),
  }),

  passwordChanged: (env: Env, when: string) => ({
    subject: "Your CloudGather password was changed",
    html: layout(env, {
      title: "Your password was changed",
      body: `<p>The password on your account was changed on ${escapeHtml(when)}. All other sessions were signed out.</p>
             <p>If this wasn't you, reset your password immediately and contact support.</p>`,
      cta: { label: "Review account security", url: `${appUrl(env)}/settings?tab=security` },
    }),
  }),

  newDeviceLogin: (env: Env, device: string, location: string, ip: string, when: string) => ({
    subject: "New sign-in to your CloudGather account",
    html: layout(env, {
      title: "New sign-in detected",
      body: `<p>Your account was accessed from a new device.</p>
        <table style="font-size:14px;color:#334155;margin-top:8px;">
          <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Device</td><td>${escapeHtml(device)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Location</td><td>${escapeHtml(location || "Unknown")}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#64748b;">IP address</td><td>${escapeHtml(ip)}</td></tr>
          <tr><td style="padding:2px 12px 2px 0;color:#64748b;">Time</td><td>${escapeHtml(when)}</td></tr>
        </table>`,
      cta: { label: "Review active sessions", url: `${appUrl(env)}/settings?tab=security` },
      footerNote: "Wasn't you? Revoke the session and change your password.",
    }),
  }),

  shareInvite: (env: Env, sender: string, itemName: string, link: string, message: string | null, permission: string) => ({
    subject: `${sender} shared "${itemName}" with you`,
    html: layout(env, {
      title: `${escapeHtml(sender)} shared a file with you`,
      preheader: `${itemName} — ${permission} access`,
      body: `<p><strong>${escapeHtml(itemName)}</strong> was shared with you with <strong>${escapeHtml(permission)}</strong> access.</p>
             ${message ? `<blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #cbd5e1;color:#475569;">${escapeHtml(message)}</blockquote>` : ""}`,
      cta: { label: "Open shared item", url: link },
    }),
  }),

  shareRevoked: (env: Env, itemName: string) => ({
    subject: `Access to "${itemName}" was removed`,
    html: layout(env, {
      title: "Share access removed",
      body: `<p>You no longer have access to <strong>${escapeHtml(itemName)}</strong>. Contact the owner if you think this was a mistake.</p>`,
    }),
  }),

  storageWarning: (env: Env, percent: number, used: string, quota: string) => ({
    subject: `You've used ${percent}% of your CloudGather storage`,
    html: layout(env, {
      title: `Storage is ${percent}% full`,
      body: `<p>You're using <strong>${escapeHtml(used)}</strong> of <strong>${escapeHtml(quota)}</strong>. Free space up by emptying the trash, or upgrade for more room.</p>`,
      cta: { label: "Review storage", url: `${appUrl(env)}/storage` },
    }),
  }),

  subscriptionChanged: (env: Env, planName: string, status: string) => ({
    subject: `Your CloudGather plan is now ${planName}`,
    html: layout(env, {
      title: `Plan updated: ${escapeHtml(planName)}`,
      body: `<p>Your subscription status is <strong>${escapeHtml(status)}</strong>. New limits apply immediately.</p>`,
      cta: { label: "View billing", url: `${appUrl(env)}/billing` },
    }),
  }),

  paymentFailed: (env: Env) => ({
    subject: "Action needed: payment failed",
    html: layout(env, {
      title: "We couldn't process your payment",
      body: `<p>Your most recent payment failed. Update your payment method to keep your plan active — we'll retry automatically for a few days.</p>`,
      cta: { label: "Update payment method", url: `${appUrl(env)}/billing` },
    }),
  }),

  contactAcknowledgement: (env: Env, name: string, subject: string) => ({
    subject: `We received your message: ${subject}`,
    html: layout(env, {
      title: `Thanks, ${escapeHtml(name)} — message received`,
      body: `<p>Our team reads every message and usually replies within one business day.</p>
             <p style="color:#64748b;font-size:13px;">Your subject: ${escapeHtml(subject)}</p>`,
    }),
  }),

  contactNotification: (env: Env, name: string, email: string, subject: string, message: string, topic: string) => ({
    subject: `[Contact] ${subject}`,
    html: layout(env, {
      title: "New contact message",
      body: `<table style="font-size:14px;"><tr><td style="color:#64748b;padding-right:12px;">From</td><td>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
             <tr><td style="color:#64748b;padding-right:12px;">Topic</td><td>${escapeHtml(topic)}</td></tr></table>
             <p style="white-space:pre-wrap;margin-top:12px;">${escapeHtml(message)}</p>`,
      cta: { label: "Open admin inbox", url: `${appUrl(env)}/admin/inbox` },
    }),
  }),

  accountDeletionScheduled: (env: Env, purgeAt: string) => ({
    subject: "Your CloudGather account is scheduled for deletion",
    html: layout(env, {
      title: "Account deletion scheduled",
      body: `<p>Your account and all managed files will be permanently deleted on <strong>${escapeHtml(purgeAt)}</strong>.</p>
             <p>Changed your mind? Sign in before then and cancel from Settings → Data.</p>`,
      cta: { label: "Cancel deletion", url: `${appUrl(env)}/settings?tab=data` },
    }),
  }),

  providerIssue: (env: Env, providerName: string, reason: string) => ({
    subject: `Action needed: ${providerName} connection needs attention`,
    html: layout(env, {
      title: `${escapeHtml(providerName)} needs to be reconnected`,
      body: `<p>We couldn't refresh access to your ${escapeHtml(providerName)} account: ${escapeHtml(reason)}.</p>
             <p>Reconnect to resume syncing and browsing those files.</p>`,
      cta: { label: "Reconnect provider", url: `${appUrl(env)}/providers` },
    }),
  }),

  announcement: (env: Env, title: string, bodyHtml: string) => ({
    subject: title,
    html: layout(env, { title, body: bodyHtml }),
  }),

  digest: (env: Env, summary: string) => ({
    subject: "Your weekly CloudGather summary",
    html: layout(env, {
      title: "Your week in CloudGather",
      body: summary,
      cta: { label: "Open dashboard", url: `${appUrl(env)}/dashboard` },
    }),
  }),
};
