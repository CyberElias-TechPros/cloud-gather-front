import { api, apiDownload, apiObjectUrl, apiUpload, apiUrl, type ProgressEvent } from "@/lib/api";
import { getProviderName } from "@/lib/providers";
import type { FileItem } from "@/types/file";
import type { FileStats, FileVersion, Paged, SavedSearch } from "@/types/api";

export type SortBy = "name" | "date" | "size" | "type";
export type SortDirection = "asc" | "desc";

export interface ActivityEvent {
  id: string;
  action: string;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  severity?: string;
  created_at: string;
}

export interface FileShare {
  id: string;
  file_id: string;
  owner_id: string;
  shared_with_email: string | null;
  permission_level: "view" | "edit" | "admin";
  created_at: string;
  expires_at: string | null;
}

export interface StorageProvider {
  id: string;
  user_id?: string;
  provider_name: string;
  provider_user_email?: string | null;
  status: string;
  total_space?: number | null;
  used_space?: number | null;
  priority?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface UploadProgress {
  fileName: string;
  percent: number;
}

const bools = (f: FileItem): FileItem => ({
  ...f,
  is_folder: Boolean(f.is_folder),
  is_starred: Boolean(f.is_starred),
  is_shared: Boolean(f.is_shared),
});

/* ------------------------------------------------------------- listing */

export interface ListOptions {
  parentId?: string | null;
  sortBy?: SortBy;
  direction?: SortDirection;
  filter?: "starred" | "shared" | "folders";
  category?: string;
  provider?: string;
  all?: boolean;
  limit?: number;
  page?: number;
}

export async function listFiles(
  parentFolderId: string | null = null,
  sortBy: SortBy = "name",
  direction: SortDirection = "asc",
) {
  const query = new URLSearchParams();
  if (parentFolderId) query.set("parent", parentFolderId);
  query.set("sort", sortBy);
  query.set("direction", direction);
  const data = await api<{ files: FileItem[] }>(`/files?${query}`);
  return data.files.map(bools);
}

export async function queryFiles(options: ListOptions = {}) {
  const query = new URLSearchParams();
  if (options.parentId) query.set("parent", options.parentId);
  if (options.all) query.set("all", "1");
  if (options.filter) query.set("filter", options.filter);
  if (options.category) query.set("category", options.category);
  if (options.provider) query.set("provider", options.provider);
  query.set("sort", options.sortBy || "name");
  query.set("direction", options.direction || "asc");
  if (options.limit) query.set("limit", String(options.limit));
  if (options.page) query.set("page", String(options.page));
  const data = await api<{ files: FileItem[] } & Paged<FileItem>>(`/files?${query}`);
  return { ...data, files: data.files.map(bools) };
}

export async function listAllFiles(sortBy: SortBy = "date", direction: SortDirection = "desc") {
  const data = await api<{ files: FileItem[] }>(`/files?all=1&sort=${sortBy}&direction=${direction}`);
  return data.files.map(bools);
}

export const listRecents = async (limit = 20) =>
  (await api<{ files: FileItem[] }>(`/files/recents?limit=${limit}`)).files.map(bools);

export const getFolderPath = async (fileId: string) =>
  (await api<{ folders: FileItem[] }>(`/files/${fileId}/path`)).folders.map(bools);

export const getFile = async (fileId: string) => bools((await api<{ file: FileItem }>(`/files/${fileId}`)).file);

export const getFolderTree = async () =>
  (await api<{ folders: { id: string; filename: string; path: string; parent_folder_id: string | null }[] }>("/files/tree")).folders;

export const getFileStats = () => api<FileStats>("/files/stats");

/* ------------------------------------------------------------- mutating */

export const createFolder = async (name: string, parent_folder_id: string | null = null) =>
  bools((await api<{ file: FileItem }>("/folders", { method: "POST", body: JSON.stringify({ name, parent_folder_id }) })).file);

export async function uploadFile(
  file: File,
  parent_folder_id: string | null = null,
  onProgress?: (progress: UploadProgress) => void,
  options: { replaceFileId?: string; signal?: AbortSignal } = {},
) {
  const form = new FormData();
  form.set("file", file);
  if (parent_folder_id) form.set("parent_folder_id", parent_folder_id);
  if (options.replaceFileId) form.set("replace_file_id", options.replaceFileId);
  const data = await apiUpload<{ file: FileItem }>("/files/upload", form, {
    signal: options.signal,
    onProgress: (progress: ProgressEvent) => onProgress?.({ fileName: file.name, percent: progress.percent }),
  });
  return bools(data.file);
}

export const deleteFile = async (file: FileItem, permanent = false) => {
  await api(`/files/${file.id}${permanent ? "?permanent=1" : ""}`, { method: "DELETE" });
};

export const renameFile = async (file: FileItem, newName: string) =>
  bools((await api<{ file: FileItem }>(`/files/${file.id}`, { method: "PATCH", body: JSON.stringify({ filename: newName }) })).file);

export const updateFile = async (fileId: string, changes: Partial<Pick<FileItem, "filename" | "description" | "tags" | "is_starred" | "parent_folder_id">>) =>
  bools((await api<{ file: FileItem }>(`/files/${fileId}`, { method: "PATCH", body: JSON.stringify(changes) })).file);

export const moveFile = (fileId: string, parentFolderId: string | null) => updateFile(fileId, { parent_folder_id: parentFolderId });

export const copyFile = async (fileId: string, parentFolderId?: string | null) =>
  bools(
    (
      await api<{ file: FileItem }>(`/files/${fileId}/copy`, {
        method: "POST",
        body: JSON.stringify(parentFolderId === undefined ? {} : { parent_folder_id: parentFolderId }),
      })
    ).file,
  );

export async function toggleStar(file: FileItem) {
  const next = !file.is_starred;
  await api(`/files/${file.id}`, { method: "PATCH", body: JSON.stringify({ is_starred: next }) });
  return next;
}

export type BulkAction = "delete" | "restore" | "purge" | "star" | "unstar" | "move";

export const bulkAction = (action: BulkAction, ids: string[], parentFolderId?: string | null) =>
  api<{ ok: boolean; affected: number; errors: { id: string; message: string }[] }>("/files/bulk", {
    method: "POST",
    body: JSON.stringify({ action, ids, parent_folder_id: parentFolderId ?? null }),
  });

/* ---------------------------------------------------------------- trash */

export const listTrash = async () => {
  const data = await api<{ files: FileItem[]; total: number; bytes: number }>("/trash");
  return { ...data, files: data.files.map(bools) };
};

export const restoreFromTrash = async (fileId: string) =>
  bools((await api<{ file: FileItem }>(`/trash/${fileId}/restore`, { method: "POST" })).file);

export const emptyTrash = () => api<{ ok: boolean; purged: number }>("/trash/empty", { method: "POST" });

/* -------------------------------------------------------------- versions */

export const listVersions = (fileId: string) =>
  api<{ current_version: number; versions: FileVersion[] }>(`/files/${fileId}/versions`);

export const restoreVersion = (fileId: string, versionId: string) =>
  api<{ file: FileItem }>(`/files/${fileId}/versions/${versionId}/restore`, { method: "POST" });

/* --------------------------------------------------------------- search */

export interface SearchOptions {
  query: string;
  category?: string;
  provider?: string;
  starred?: boolean;
  from?: string;
  to?: string;
  minSize?: number;
  maxSize?: number;
  limit?: number;
}

export async function searchFiles(options: SearchOptions) {
  const query = new URLSearchParams({ q: options.query });
  if (options.category) query.set("category", options.category);
  if (options.provider) query.set("provider", options.provider);
  if (options.starred) query.set("starred", "1");
  if (options.from) query.set("from", options.from);
  if (options.to) query.set("to", options.to);
  if (options.minSize) query.set("min_size", String(options.minSize));
  if (options.maxSize) query.set("max_size", String(options.maxSize));
  if (options.limit) query.set("limit", String(options.limit));
  const data = await api<{ files: FileItem[]; total: number; remote?: unknown[] }>(`/search?${query}`);
  return { ...data, files: data.files.map(bools) };
}

export const listSavedSearches = async () => (await api<{ searches: SavedSearch[] }>("/saved-searches")).searches;
export const saveSearch = (name: string, query: string, filters: Record<string, unknown> = {}) =>
  api<{ search: SavedSearch }>("/saved-searches", { method: "POST", body: JSON.stringify({ name, query, filters }) });
export const deleteSavedSearch = (id: string) => api(`/saved-searches/${id}`, { method: "DELETE" });

/* ------------------------------------------------------------ transfers */

export const downloadFile = (file: FileItem) => apiDownload(`/files/${file.id}/download`, file.filename);

export const previewUrl = (file: FileItem) => apiUrl(`/files/${file.id}/preview`);

export async function getPreviewUrl(file: FileItem) {
  if (file.is_folder) return null;
  const mime = file.mime_type || "";
  if (!/^(image|text|video|audio)\//.test(mime) && mime !== "application/pdf") return null;
  return apiObjectUrl(`/files/${file.id}/download?inline=1`);
}

/* --------------------------------------------------------------- shares */

export const listShares = async (fileId: string) => (await api<{ shares: FileShare[] }>(`/files/${fileId}/shares`)).shares;

export const shareFile = async (
  file: FileItem,
  email: string,
  permission: "view" | "edit" = "view",
  expiresAt?: string | null,
  message?: string,
) =>
  (
    await api<{ share: FileShare }>(`/files/${file.id}/shares`, {
      method: "POST",
      body: JSON.stringify({ email, permission_level: permission, expires_at: expiresAt, message }),
    })
  ).share;

export const revokeShare = async (shareId: string) => {
  await api(`/shares/${shareId}`, { method: "DELETE" });
};

/* ------------------------------------------------------------ providers */

export const listProviders = async () => (await api<{ providers: StorageProvider[] }>("/providers")).providers;
export const disconnectProvider = async (providerId: string) => {
  await api(`/providers/${providerId}`, { method: "DELETE" });
};
export const updateProviderOrder = async (orderedIds: string[]) => {
  await api("/providers/order", { method: "PATCH", body: JSON.stringify({ ids: orderedIds }) });
};

/* ------------------------------------------------------------- activity */

export const recordActivity = async (
  action: string,
  resourceType?: string,
  resourceId?: string,
  details: Record<string, unknown> = {},
) => {
  await api("/activity", { method: "POST", body: JSON.stringify({ action, resourceType, resourceId, details }) });
};

export const listActivity = async (limit = 20) =>
  (await api<{ activity: ActivityEvent[] }>(`/activity?limit=${Math.min(limit, 100)}`)).activity;

export { getProviderName };
