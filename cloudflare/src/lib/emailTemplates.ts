/**
 * Transactional email templates. Deliberately plain, text-first HTML — no
 * tracking pixels, no remote assets, no marketing injection.
 */

interface Brand {
  appName: string;
  appUrl: string;
  supportEmail: string;
}

function shell(brand: Brand, heading: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html><body style="margin:0;background:#0b1020;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e6e9f5">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:560px;background:#131a2f;border:1px solid #24304f;border-radius:16px;padding:32px">
      <tr><td>
        <p style="margin:0 0 24px;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#7c8db5">${escapeHtml(brand.appName)}</p>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#ffffff">${escapeHtml(heading)}</h1>
        <div style="font-size:15px;line-height:1.65;color:#c3cbe4">${body}</div>
        ${cta ? `<p style="margin:28px 0 8px"><a href="${cta.url}" style="display:inline-block;background:#4f6ef7;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${escapeHtml(cta.label)}</a></p>
        <p style="margin:8px 0 0;font-size:12px;color:#7c8db5;word-break:break-all">${cta.url}</p>` : ""}
        <hr style="border:none;border-top:1px solid #24304f;margin:28px 0 16px" />
        <p style="margin:0;font-size:12px;color:#7c8db5">
          You received this because of activity on your ${escapeHtml(brand.appName)} account.
          Need help? <a href="mailto:${brand.supportEmail}" style="color:#8aa4ff">${escapeHtml(brand.supportEmail)}</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function welcomeEmail(brand: Brand, name: string) {
  const subject = `Welcome to ${brand.appName}`;
  const body = `<p>Hi ${escapeHtml(name)},</p>
    <p>Your ${escapeHtml(brand.appName)} account is ready. Connect a storage provider to bring
    Google Drive, Dropbox, OneDrive and more into one searchable pool — or start by uploading
    a file to your ${escapeHtml(brand.appName)} storage.</p>`;
  return {
    subject,
    html: shell(brand, "Your workspace is ready", body, { label: "Open your dashboard", url: `${brand.appUrl}/dashboard` }),
    text: `Welcome to ${brand.appName}. Open your dashboard: ${brand.appUrl}/dashboard`,
  };
}

export function resetPasswordEmail(brand: Brand, url: string, ttlMinutes: number) {
  const subject = `Reset your ${brand.appName} password`;
  const body = `<p>We received a request to reset your password.</p>
    <p>This link expires in ${ttlMinutes} minutes and can only be used once. If you did not
    request it, you can safely ignore this email — your password will not change.</p>`;
  return {
    subject,
    html: shell(brand, "Reset your password", body, { label: "Choose a new password", url }),
    text: `Reset your ${brand.appName} password (expires in ${ttlMinutes} minutes): ${url}`,
  };
}

export function verifyEmailEmail(brand: Brand, url: string) {
  const subject = `Confirm your email for ${brand.appName}`;
  const body = `<p>Confirm this address to finish setting up your account.</p>`;
  return {
    subject,
    html: shell(brand, "Confirm your email", body, { label: "Confirm email address", url }),
    text: `Confirm your ${brand.appName} email address: ${url}`,
  };
}

export function shareEmail(brand: Brand, sharerName: string, fileName: string, url: string, expiresAt: string | null) {
  const subject = `${sharerName} shared "${fileName}" with you`;
  const body = `<p>${escapeHtml(sharerName)} shared <strong>${escapeHtml(fileName)}</strong> with you on ${escapeHtml(brand.appName)}.</p>
    ${expiresAt ? `<p>This link expires on ${escapeHtml(new Date(expiresAt).toDateString())}.</p>` : ""}`;
  return {
    subject,
    html: shell(brand, "A file was shared with you", body, { label: "Open the file", url }),
    text: `${sharerName} shared "${fileName}" with you: ${url}`,
  };
}

export function securityAlertEmail(brand: Brand, title: string, detail: string) {
  const subject = `${brand.appName} security notice: ${title}`;
  const body = `<p>${escapeHtml(detail)}</p>
    <p>If this was not you, reset your password immediately and revoke active sessions from
    Settings → Security.</p>`;
  return {
    subject,
    html: shell(brand, title, body, { label: "Review account security", url: `${brand.appUrl}/settings` }),
    text: `${title}. ${detail}`,
  };
}

export function storageWarningEmail(brand: Brand, percent: number, usedGb: string, quotaGb: string) {
  const subject = `You have used ${percent}% of your ${brand.appName} storage`;
  const body = `<p>Your pool is at ${percent}% — ${usedGb} GB of ${quotaGb} GB used.</p>
    <p>Free up space by emptying the trash, or review what is taking up room in Storage.</p>`;
  return {
    subject,
    html: shell(brand, `Storage at ${percent}%`, body, { label: "Review storage", url: `${brand.appUrl}/storage` }),
    text: `Storage at ${percent}% (${usedGb} GB of ${quotaGb} GB used).`,
  };
}
