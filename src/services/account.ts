import { api, apiDownload, apiUpload } from "@/lib/api";
import type { Entitlements, NotificationPreferences, OnboardingStep, SessionRecord } from "@/types/api";
import type { FileItem } from "@/types/file";

/* -------------------------------------------------------------- profile */

export interface ProfileInput {
  display_name?: string;
  avatar_url?: string | null;
  locale?: string;
  timezone?: string | null;
  marketing_opt_in?: boolean;
}

export const updateProfile = (input: ProfileInput) =>
  api<{ user: Record<string, unknown> }>("/profile", { method: "PATCH", body: JSON.stringify(input) });

export const uploadAvatar = (file: File) => {
  const form = new FormData();
  form.set("file", file);
  return apiUpload<{ avatar_url: string }>("/profile/avatar", form);
};

export const removeAvatar = () => api("/profile/avatar", { method: "DELETE" });

export const getPreferences = () =>
  api<{ preferences: Record<string, unknown>; notifications: NotificationPreferences }>("/preferences");

export const savePreferences = (preferences: Record<string, unknown>) =>
  api<{ preferences: Record<string, unknown>; notifications: NotificationPreferences }>("/preferences", {
    method: "PATCH",
    body: JSON.stringify(preferences),
  });

/* ------------------------------------------------------------ dashboard */

export interface DashboardPayload {
  user: Record<string, unknown>;
  entitlements: Entitlements;
  recent_files: FileItem[];
  recent_activity: { id: string; action: string; resource_type: string | null; severity: string; created_at: string }[];
  providers: { id: string; provider_name: string; display_name: string | null; status: string; file_count: number; used_space: number | null; total_space: number | null; last_sync_at: string | null; last_error: string | null }[];
  shared_with_me: { id: string; filename: string; shared_by: string; permission_level: string; created_at: string }[];
  unread_notifications: number;
  announcement: { id: string; title: string; body: string; level: string } | null;
  categories: { category: string; total: number; bytes: number }[];
  onboarding_complete: boolean;
  billing_enabled: boolean;
}

export const getDashboard = () => api<DashboardPayload>("/dashboard");

/* ------------------------------------------------------------- security */

export const listSessions = async () => (await api<{ sessions: SessionRecord[] }>("/auth/sessions")).sessions;
export const revokeSession = (id: string) => api(`/auth/sessions/${id}`, { method: "DELETE" });
export const revokeAllSessions = () => api<{ ok: boolean; revoked: number }>("/auth/logout-all", { method: "POST" });

export const changePassword = (currentPassword: string, password: string) =>
  api<{ ok: boolean }>("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword, password }) });

export const startTwoFactor = () => api<{ secret: string; otpauth_url: string }>("/auth/2fa/setup", { method: "POST" });
export const enableTwoFactor = (code: string) =>
  api<{ ok: boolean; recovery_codes: string[] }>("/auth/2fa/enable", { method: "POST", body: JSON.stringify({ code }) });
export const disableTwoFactor = (password: string) =>
  api<{ ok: boolean }>("/auth/2fa/disable", { method: "POST", body: JSON.stringify({ password }) });
export const regenerateRecoveryCodes = () =>
  api<{ recovery_codes: string[] }>("/auth/2fa/recovery-codes", { method: "POST" });

export const listIdentities = async () =>
  (await api<{ identities: { id: string; provider: string; email: string | null; created_at: string }[] }>("/auth/identities")).identities;
export const unlinkIdentity = (id: string) => api(`/auth/identities/${id}`, { method: "DELETE" });

export const sendVerificationEmail = () => api<{ ok: boolean }>("/auth/email/verify/send", { method: "POST" });
export const confirmVerificationEmail = (token: string) =>
  api<{ ok: boolean; user?: Record<string, unknown> }>("/auth/email/verify/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });

/* ----------------------------------------------------------- onboarding */

export const getOnboarding = () =>
  api<{ steps: OnboardingStep[]; completed: number; total: number; dismissed: boolean }>("/auth/onboarding");
export const completeOnboarding = () => api<{ ok: boolean }>("/auth/onboarding/complete", { method: "POST" });

/* ----------------------------------------------------- data and deletion */

export const exportAccountData = () => apiDownload("/export", "cloudgather-export.json");

export const requestAccountDeletion = (password?: string) =>
  api<{ ok: boolean; purge_at: string; grace_days: number }>("/account", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });

export const cancelAccountDeletion = () => api<{ ok: boolean }>("/account/restore", { method: "POST" });
