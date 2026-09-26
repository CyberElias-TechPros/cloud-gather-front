import { api } from "@/lib/api";
import type { ApiKeyRecord } from "@/types/api";

export interface ApiKeyListResponse {
  keys: ApiKeyRecord[];
  scopes: string[];
  limits: { max_keys: number };
}

export const listApiKeys = () => api<ApiKeyListResponse>("/api-keys");

export const createApiKey = (input: { name: string; permissions: string[]; description?: string; expires_at?: string | null }) =>
  api<{ key: ApiKeyRecord & { key: string }; warning: string }>("/api-keys", { method: "POST", body: JSON.stringify(input) });

export const updateApiKey = (id: string, changes: { name?: string; description?: string; permissions?: string[]; expires_at?: string | null }) =>
  api<{ key: ApiKeyRecord }>(`/api-keys/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const rotateApiKey = (id: string) =>
  api<{ key: ApiKeyRecord & { key: string }; warning: string }>(`/api-keys/${id}/rotate`, { method: "POST" });

export const deleteApiKey = (id: string) => api(`/api-keys/${id}`, { method: "DELETE" });
