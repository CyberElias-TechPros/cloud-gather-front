import { api } from "@/lib/api";
import type { Announcement, ContactMessage, Paged } from "@/types/api";

/* ---------------------------------------------------------------- stats */

export interface AdminStats {
  userCount: number;
  fileCount: number;
  providerCount: number;
  blogCount: number;
  recentActivities: { id: string; action: string; resource_type: string; severity?: string; actor_email?: string | null; created_at: string }[];
  degraded: boolean;
  metrics: {
    managed_storage_bytes: number;
    trash_bytes: number;
    active_sessions: number;
    pending_emails: number;
    failed_webhooks_24h: number;
    open_tickets: number;
    plans: { plan: string; total: number }[];
  };
  charts: { signups_by_day: { day: string; total: number }[]; uploads_by_day: { day: string; total: number; bytes: number }[] };
  health: { database: boolean; storage: boolean };
}

export const getStats = () => api<AdminStats>("/admin/stats");

/* ---------------------------------------------------------------- users */

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "pending_deletion";
  plan: string;
  avatar_url: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  totp_enabled_at: string | null;
  storage_quota_bytes: number | null;
  storage_bytes: number;
  file_count: number;
}

export const listUsers = (options: { search?: string; role?: string; status?: string; page?: number } = {}) => {
  const params = new URLSearchParams();
  if (options.search) params.set("search", options.search);
  if (options.role) params.set("role", options.role);
  if (options.status) params.set("status", options.status);
  if (options.page) params.set("page", String(options.page));
  return api<{ users: AdminUser[]; admins: { id: string; email: string; display_name: string; created_at: string }[] } & Paged<AdminUser>>(
    `/admin/users${params.toString() ? `?${params}` : ""}`,
  );
};

export const getUser = (id: string) => api<Record<string, unknown>>(`/admin/users/${id}`);

export const updateUser = (
  id: string,
  changes: { role?: string; status?: string; plan?: string; display_name?: string; storage_quota_bytes?: number | null; email_verified?: boolean },
) => api<{ user: AdminUser }>(`/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const setUserRole = (email: string, role: "user" | "admin") =>
  api<{ ok: boolean }>("/admin/users/role", { method: "POST", body: JSON.stringify({ email, role }) });

export const sendPasswordReset = (id: string) => api<{ ok: boolean }>(`/admin/users/${id}/password-reset`, { method: "POST" });

export const revokeUserSessions = (id: string) => api<{ ok: boolean; revoked: number }>(`/admin/users/${id}/sessions/revoke`, { method: "POST" });

export const deleteUser = (id: string, purge = false) =>
  api<{ ok: boolean; purge_at?: string }>(`/admin/users/${id}${purge ? "?purge=1" : ""}`, { method: "DELETE" });

/* ------------------------------------------------------------- settings */

export interface AdminSetting {
  id: string;
  setting_key: string;
  setting_value: unknown;
  description: string | null;
  default_value?: unknown;
}

export const getSettings = async () => (await api<{ settings: AdminSetting[] }>("/admin/settings")).settings;

export const saveSettings = (changes: { key: string; value: unknown }[]) =>
  api<{ ok: boolean }>("/admin/settings", { method: "PATCH", body: JSON.stringify({ changes }) });

export const toggleMaintenance = (enabled: boolean, message?: string) =>
  api<{ ok: boolean; maintenance_mode: boolean }>("/admin/maintenance", {
    method: "POST",
    body: JSON.stringify({ enabled, message }),
  });

/* ---------------------------------------------------------------- audit */

export const listAuditLog = (options: { action?: string; user_id?: string; severity?: string; page?: number } = {}) => {
  const params = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => value && params.set(key, String(value)));
  return api<Paged<{ id: string; action: string; actor_email: string | null; resource_type: string | null; severity: string; ip_address: string | null; created_at: string; details: Record<string, unknown> }>>(
    `/admin/audit${params.toString() ? `?${params}` : ""}`,
  );
};

/* -------------------------------------------------------------- content */

export const listContactMessages = (status?: string) =>
  api<Paged<ContactMessage>>(`/admin/contact${status ? `?status=${status}` : ""}`);

export const updateContactMessage = (id: string, changes: { status?: string; reply?: string }) =>
  api<{ message: ContactMessage }>(`/admin/contact/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteContactMessage = (id: string) => api(`/admin/contact/${id}`, { method: "DELETE" });

export const listSubscribers = () => api<Paged<{ id: string; email: string; source: string | null; created_at: string }>>("/admin/newsletter");

export interface AdminBlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  tags: string[];
  image: string | null;
  published: number | boolean;
  published_at: string | null;
  reading_minutes: number;
  featured: number | boolean;
  view_count: number;
  created_at: string;
}

export const listBlogPosts = () => api<Paged<AdminBlogPost>>("/admin/blog");

export const createBlogPost = (input: Partial<AdminBlogPost>) =>
  api<{ post: AdminBlogPost }>("/admin/blog", { method: "POST", body: JSON.stringify(input) });

export const updateBlogPost = (id: string, changes: Partial<AdminBlogPost>) =>
  api<{ post: AdminBlogPost }>(`/admin/blog/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteBlogPost = (id: string) => api(`/admin/blog/${id}`, { method: "DELETE" });

export const duplicateBlogPost = (id: string) => api<{ post: AdminBlogPost }>(`/admin/blog/${id}/duplicate`, { method: "POST" });

/* -------------------------------------------------------- announcements */

export const listAnnouncements = async () => (await api<{ announcements: Announcement[] }>("/admin/announcements")).announcements;

export const createAnnouncement = (input: Partial<Announcement>) =>
  api<{ announcement: Announcement }>("/admin/announcements", { method: "POST", body: JSON.stringify(input) });

export const updateAnnouncement = (id: string, changes: Partial<Announcement>) =>
  api<{ announcement: Announcement }>(`/admin/announcements/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteAnnouncement = (id: string) => api(`/admin/announcements/${id}`, { method: "DELETE" });

export const broadcastAnnouncement = (id: string) =>
  api<{ ok: boolean; delivered: number }>(`/admin/announcements/${id}/broadcast`, { method: "POST" });

/* ----------------------------------------------------------- operations */

export const listOutbox = (status = "pending") =>
  api<Paged<{ id: string; to_email: string; subject: string; status: string; attempts: number; last_error: string | null; created_at: string }>>(
    `/admin/email-outbox?status=${status}`,
  );

export const flushOutbox = () => api<{ sent: number; failed: number }>("/admin/email-outbox/flush", { method: "POST" });

export const getStorageReport = () =>
  api<{
    top_users: { id: string; email: string; plan: string; bytes: number; files: number }[];
    by_category: { category: string; files: number; bytes: number }[];
    providers: { provider_name: string; connections: number; errors: number }[];
  }>("/admin/storage");

export const runMaintenanceTask = (task = "all") =>
  api<{ ok: boolean; task: string; result: Record<string, unknown> }>("/admin/cron/run", {
    method: "POST",
    body: JSON.stringify({ task }),
  });
