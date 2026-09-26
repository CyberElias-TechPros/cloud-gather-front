import { api } from "@/lib/api";
import type { WebhookDelivery, WebhookEndpoint } from "@/types/api";

export interface WebhookListResponse {
  endpoints: WebhookEndpoint[];
  events: string[];
  limits: { max_endpoints: number };
  available: boolean;
}

export const listWebhooks = () => api<WebhookListResponse>("/webhooks");

export const createWebhook = (input: { url: string; events: string[]; description?: string }) =>
  api<{ endpoint: WebhookEndpoint; secret: string; warning: string }>("/webhooks", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const updateWebhook = (id: string, changes: { url?: string; events?: string[]; description?: string; enabled?: boolean }) =>
  api<{ endpoint: WebhookEndpoint }>(`/webhooks/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const deleteWebhook = (id: string) => api(`/webhooks/${id}`, { method: "DELETE" });

export const testWebhook = (id: string) => api<{ ok: boolean; status: number; response: string }>(`/webhooks/${id}/test`, { method: "POST" });

export const listDeliveries = async (id: string) =>
  (await api<{ deliveries: WebhookDelivery[] }>(`/webhooks/${id}/deliveries`)).deliveries;

export const revealSecret = (id: string) => api<{ secret: string }>(`/webhooks/${id}/secret`);
