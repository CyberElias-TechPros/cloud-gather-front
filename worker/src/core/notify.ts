/**
 * Unified notification fan-out: writes an in-app notification and optionally
 * mirrors it to email, honouring each user's notification preferences.
 */
import type { Env } from "../env";
import { all, first, run } from "./db";
import { sendEmail } from "./email";
import { id, parseJson } from "./util";

export type NotificationType =
  | "share.received"
  | "share.revoked"
  | "file.comment"
  | "storage.warning"
  | "storage.full"
  | "provider.error"
  | "provider.connected"
  | "security.login"
  | "security.password"
  | "security.mfa"
  | "billing.updated"
  | "billing.failed"
  | "system.announcement"
  | "account.deletion";

export interface NotificationPreferences {
  emailProductUpdates: boolean;
  emailSecurityAlerts: boolean;
  emailSharing: boolean;
  emailStorageAlerts: boolean;
  emailBilling: boolean;
  emailWeeklyDigest: boolean;
  inAppAll: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailProductUpdates: false,
  emailSecurityAlerts: true,
  emailSharing: true,
  emailStorageAlerts: true,
  emailBilling: true,
  emailWeeklyDigest: false,
  inAppAll: true,
};

export function readNotificationPreferences(settings: unknown): NotificationPreferences {
  const source = (settings && typeof settings === "object" ? (settings as Record<string, unknown>).notifications : null) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!source) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  const read = (key: keyof NotificationPreferences) =>
    typeof source[key] === "boolean" ? (source[key] as boolean) : DEFAULT_NOTIFICATION_PREFERENCES[key];
  return {
    emailProductUpdates: read("emailProductUpdates"),
    emailSecurityAlerts: read("emailSecurityAlerts"),
    emailSharing: read("emailSharing"),
    emailStorageAlerts: read("emailStorageAlerts"),
    emailBilling: read("emailBilling"),
    emailWeeklyDigest: read("emailWeeklyDigest"),
    inAppAll: read("inAppAll"),
  };
}

/** Which preference gates which notification type. */
function preferenceKeyFor(type: NotificationType): keyof NotificationPreferences | null {
  if (type.startsWith("share.")) return "emailSharing";
  if (type.startsWith("storage.")) return "emailStorageAlerts";
  if (type.startsWith("security.")) return "emailSecurityAlerts";
  if (type.startsWith("billing.")) return "emailBilling";
  if (type === "system.announcement") return "emailProductUpdates";
  return null;
}

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string | null;
  data?: Record<string, unknown>;
  email?: { subject: string; html: string } | null;
  /** Security/billing mail that must be delivered regardless of preferences. */
  forceEmail?: boolean;
}

export async function notify(env: Env, input: NotifyInput): Promise<void> {
  const user = await first<{ email: string; settings: string; status: string }>(
    env,
    "SELECT email, settings, status FROM users WHERE id = ?",
    input.userId,
  );
  if (!user || user.status === "suspended") return;

  const preferences = readNotificationPreferences(parseJson<Record<string, unknown>>(user.settings, {}));

  if (preferences.inAppAll) {
    await run(
      env,
      `INSERT INTO notifications(id, user_id, type, title, body, link, data) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      id(),
      input.userId,
      input.type,
      input.title,
      input.body ?? null,
      input.link ?? null,
      JSON.stringify(input.data ?? {}),
    ).catch(() => undefined);
  }

  if (input.email) {
    const key = preferenceKeyFor(input.type);
    const allowed = input.forceEmail || !key || preferences[key];
    if (allowed) {
      await sendEmail(env, {
        to: user.email,
        subject: input.email.subject,
        html: input.email.html,
        tag: input.type,
        userId: input.userId,
      });
    }
  }
}

/** Sends a notification to every administrator (used for ops alerts). */
export async function notifyAdmins(env: Env, input: Omit<NotifyInput, "userId">): Promise<void> {
  const admins = await all<{ id: string }>(env, "SELECT id FROM users WHERE role = 'admin' AND status = 'active'");
  for (const admin of admins) await notify(env, { ...input, userId: admin.id });
}

export async function markAllRead(env: Env, userId: string): Promise<number> {
  const result = await run(env, "UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL", userId);
  return result.meta.changes ?? 0;
}

export async function unreadCount(env: Env, userId: string): Promise<number> {
  const row = await first<{ value: number }>(
    env,
    "SELECT count(*) AS value FROM notifications WHERE user_id = ? AND read_at IS NULL",
    userId,
  );
  return Number(row?.value ?? 0);
}
