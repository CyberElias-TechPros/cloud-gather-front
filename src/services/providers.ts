import { api } from "@/lib/api";
import type { ConnectedProvider, ProviderCatalogueEntry, RemoteEntry } from "@/types/api";
import type { FileItem } from "@/types/file";

export const getCatalogue = async () =>
  (await api<{ providers: ProviderCatalogueEntry[]; roadmap: { id: string; name: string; note: string }[] }>("/providers/catalogue"));

export const listConnections = async () => (await api<{ providers: ConnectedProvider[] }>("/providers")).providers;

/** Returns the provider's consent screen URL; the caller redirects the browser. */
export const startOAuth = (providerId: string, returnTo = `${window.location.origin}/providers`) =>
  api<{ url: string }>(`/providers/${providerId}/oauth?return_to=${encodeURIComponent(returnTo)}`);

export const connectWithCredentials = (provider: string, credentials: Record<string, string>, displayName?: string) =>
  api<{ provider: ConnectedProvider }>("/providers/connect", {
    method: "POST",
    body: JSON.stringify({ provider, credentials, display_name: displayName }),
  });

export const updateConnection = (id: string, changes: { display_name?: string; is_default?: boolean }) =>
  api<{ provider: ConnectedProvider }>(`/providers/${id}`, { method: "PATCH", body: JSON.stringify(changes) });

export const reorderConnections = (ids: string[]) =>
  api<{ ok: boolean }>("/providers/order", { method: "PATCH", body: JSON.stringify({ ids }) });

export const disconnect = (id: string) => api(`/providers/${id}`, { method: "DELETE" });

export const syncProvider = (id: string) =>
  api<{ ok: boolean; indexed: number; provider: ConnectedProvider }>(`/providers/${id}/sync`, { method: "POST" });

export const browseProvider = (id: string, folderId?: string | null, query?: string) => {
  const params = new URLSearchParams();
  if (folderId) params.set("folder", folderId);
  if (query) params.set("q", query);
  return api<{ entries: RemoteEntry[]; folder: string | null; cursor?: string | null }>(
    `/providers/${id}/browse${params.toString() ? `?${params}` : ""}`,
  );
};

export const importFromProvider = (
  id: string,
  input: { file_id: string; name?: string; parent_folder_id?: string | null; copy?: boolean },
) => api<{ file: FileItem; copied: boolean }>(`/providers/${id}/import`, { method: "POST", body: JSON.stringify(input) });

export const exportToProvider = (id: string, fileId: string, folderId?: string | null) =>
  api<{ ok: boolean; remote: RemoteEntry }>(`/providers/${id}/export`, {
    method: "POST",
    body: JSON.stringify({ file_id: fileId, folder_id: folderId ?? null }),
  });
