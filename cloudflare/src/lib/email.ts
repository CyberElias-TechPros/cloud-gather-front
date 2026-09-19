/**
 * Transactional e-mail.
 *
 * Delivery uses Resend's HTTP API when `RESEND_API_KEY` is configured. Without
 * it the Worker still behaves correctly — the message is logged (never silently
 * dropped) and callers are told delivery was skipped, so the surrounding flow can
 * decide whether that is fatal. Nothing here ever blocks a user request on a
 * third-party outage.
 */

import { escapeHtml } from "./http";
import type { Env } from "../types";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  delivered: boolean;
  skipped: boolean;
  id?: string;
  error?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail(env: Env, message: EmailMessage): Promise<EmailResult> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email] skipped (no RESEND_API_KEY): "${message.subject}" → ${message.to}`);
    return { delivered: false, skipped: true };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || `${env.APP_NAME || "CloudGather"} <noreply@cloudgather.app>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        reply_to: message.replyTo,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[email] provider rejected the message (${response.status}): ${detail.slice(0, 300)}`);
      return { delivered: false, skipped: false, error: `provider_${response.status}` };
    }

    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    return { delivered: true, skipped: false, id: payload.id };
  } catch (error) {
    console.error("[email] send failed", error instanceof Error ? error.message : error);
    return { delivered: false, skipped: false, error: "network_error" };
  }
}

/** Fire-and-forget: queues the message so the request is never held up. */
export async function queueEmail(env: Env, message: EmailMessage): Promise<void> {
  try {
    await env.JOBS.send({ type: "email.send", message });
  } catch (error) {
    console.warn("[email] could not queue message", error instanceof Error ? error.message : error);
    // Last resort: attempt a direct send so the mail is not lost.
    await sendEmail(env, message);
  }
}

// ---------------------------------------------------------------------------
// Templates — deliberately plain HTML: they render everywhere, including the
// preview panes that strip CSS.
// ---------------------------------------------------------------------------

interface LayoutOptions {
  appName: string;
  appUrl: string;
  title: string;
  body: string;
  cta?: { label: string; url: string };
  footer?: string;
}

export function layout({ appName, appUrl, title, body, cta, footer }: LayoutOptions): string {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#101322">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;border:1px solid #e6e8ef">
    <tr><td style="padding:28px 32px 8px">
      <a href="${escapeHtml(appUrl)}" style="font-size:18px;font-weight:600;color:#101322;text-decoration:none">${escapeHtml(appName)}</a>
    </td></tr>
    <tr><td style="padding:8px 32px 0">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#3c4257">${body}</div>
    </td></tr>
    ${
      cta
        ? `<tr><td style="padding:24px 32px 8px">
      <a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;font-size:15px">${escapeHtml(cta.label)}</a>
    </td></tr>`
        : ""
    }
    <tr><td style="padding:24px 32px 28px;border-top:1px solid #eef0f5;font-size:13px;color:#6b7280;line-height:1.6">
      ${footer ?? `You are receiving this because you have a ${escapeHtml(appName)} account.`}
    </td></tr>
  </table>
</body></html>`;
}

const BUTTON_FALLBACK = (url: string) =>
  `<p style="word-break:break-all;font-size:13px;color:#6b7280">If the button does not work, paste this link into your browser:<br />${escapeHtml(url)}</p>`;

export const templates = {
  welcome: (appName: string, appUrl: string, name: string) => ({
    subject: `Welcome to ${appName}`,
    html: layout({
      appName,
      appUrl,
      title: `Welcome aboard, ${name}`,
      body: `<p>Your account is ready. Connect the drives you already use, then browse, search and share everything from one place.</p>
             <p>Two things worth doing first:</p>
             <ul style="padding-left:18px"><li>Connect a drive in <strong>Providers</strong></li><li>Upload a file and try a share link</li></ul>`,
      cta: { label: "Open your dashboard", url: `${appUrl}/dashboard` },
    }),
  }),

  verifyEmail: (appName: string, url: string) => ({
    subject: `Confirm your ${appName} email address`,
    html: layout({
      appName,
      appUrl: url.split("/api/")[0] || url,
      title: "Confirm your email address",
      body: `<p>One click and your account is fully verified.</p>${BUTTON_FALLBACK(url)}`,
      cta: { label: "Confirm email", url },
    }),
  }),

  passwordReset: (appName: string, url: string) => ({
    subject: `Reset your ${appName} password`,
    html: layout({
      appName,
      appUrl: url.split("/api/")[0] || url,
      title: "Reset your password",
      body: `<p>This link is valid for one hour and can be used once. If you did not ask for a reset, you can safely ignore this email — your password has not changed.</p>${BUTTON_FALLBACK(url)}`,
      cta: { label: "Choose a new password", url },
    }),
  }),

  passwordChanged: (appName: string, appUrl: string) => ({
    subject: `Your ${appName} password was changed`,
    html: layout({
      appName,
      appUrl,
      title: "Your password was changed",
      body: `<p>The password on your account was just changed, and every other session was signed out.</p><p>If this was not you, reset your password immediately and contact support.</p>`,
      cta: { label: "Reset password", url: `${appUrl}/reset-password` },
    }),
  }),

  shareReceived: (appName: string, appUrl: string, sharer: string, fileName: string, url: string, expiresAt: string | null) => ({
    subject: `${sharer} shared "${fileName}" with you`,
    html: layout({
      appName,
      appUrl,
      title: `${sharer} shared a file with you`,
      body: `<p><strong>${escapeHtml(fileName)}</strong> is ready to open or download.</p>${
        expiresAt ? `<p>This link expires on ${escapeHtml(new Date(expiresAt).toUTCString())}.</p>` : ""
      }`,
      cta: { label: "Open file", url },
      footer: "You received this because someone shared a file with your email address.",
    }),
  }),

  storageWarning: (appName: string, appUrl: string, percent: number, used: string, quota: string) => ({
    subject: `You have used ${percent}% of your ${appName} storage`,
    html: layout({
      appName,
      appUrl,
      title: `Storage is ${percent}% full`,
      body: `<p>You are using ${escapeHtml(used)} of your ${escapeHtml(quota)} allowance.</p><p>Uploads stop when the allowance is full, so it is worth clearing large items from the trash or upgrading your plan.</p>`,
      cta: { label: "Review storage", url: `${appUrl}/storage` },
    }),
  }),

  contactConfirmation: (appName: string, appUrl: string, name: string) => ({
    subject: `We received your message`,
    html: layout({
      appName,
      appUrl,
      title: `Thanks for writing in, ${name}`,
      body: `<p>A human will read your message and reply to this address. Most questions are answered within one business day.</p>`,
      cta: { label: "Back to CloudGather", url: appUrl },
    }),
  }),
};
