import { api } from "@/lib/api";
import type { NotificationPreferences, NotificationRecord } from "@/types/api";

export const listNotifications = (options: { unread?: boolean; limit?: number } = {}) => {
  const params = new URLSearchParams();
  if (options.unread) params.set("unread", "1");
  if (options.limit) params.set("limit", String(options.limit));
  return api<{ notifications: NotificationRecord[]; total: number; unread: number }>(
    `/notifications${params.toString() ? `?${params}` : ""}`,
  );
};

export const unreadCount = () => api<{ unread: number }>("/notifications/unread-count");

export const markRead = (id: string) => api<{ ok: boolean; unread: number }>(`/notifications/${id}/read`, { method: "POST" });

export const markAllRead = () => api<{ ok: boolean; updated: number; unread: number }>("/notifications/read-all", { method: "POST" });

export const deleteNotification = (id: string) => api(`/notifications/${id}`, { method: "DELETE" });

export const clearRead = () => api("/notifications", { method: "DELETE" });

export const getPreferences = () =>
  api<{ preferences: NotificationPreferences; defaults: NotificationPreferences }>("/notifications/preferences");

export const savePreferences = (changes: Partial<NotificationPreferences>) =>
  api<{ preferences: NotificationPreferences }>("/notifications/preferences", {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
