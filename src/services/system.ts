import { api } from "@/lib/api";
import type { Announcement, AppConfig, StatusPayload } from "@/types/api";

export const getConfig = () => api<AppConfig>("/config");

export const getStatus = () => api<StatusPayload>("/status");

export const getHealth = () =>
  api<{ status: string; version: string; environment: string; checks: Record<string, { ok: boolean; provider?: string }> }>("/health");

export const listAnnouncements = async () => (await api<{ announcements: Announcement[] }>("/announcements")).announcements;

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  topic?: string;
  company?: string;
  turnstile_token?: string;
}

export const submitContactForm = (input: ContactInput) =>
  api<{ ok: boolean; id: string; message: string }>("/contact", { method: "POST", body: JSON.stringify(input) });

export const subscribeNewsletter = (email: string, source = "website") =>
  api<{ ok: boolean; message: string }>("/newsletter", { method: "POST", body: JSON.stringify({ email, source }) });

export const unsubscribeNewsletter = (email: string) =>
  api<{ ok: boolean }>("/newsletter/unsubscribe", { method: "POST", body: JSON.stringify({ email }) });

export const listMyEnquiries = async () =>
  (
    await api<{ messages: { id: string; subject: string; topic: string; status: string; message: string; reply: string | null; replied_at: string | null; created_at: string }[] }>(
      "/contact/mine",
    )
  ).messages;
