/**
 * Typed client for the CloudGather API (Cloudflare Worker).
 *
 * Every request is same-origin (`/api/...`) — Vite proxies it in development and
 * Vercel rewrites it in production — so the httpOnly session cookie is sent
 * automatically and no token ever touches JavaScript.
 */

import type {
  ActivityEvent,
  AdminOverview,
  AdminUser,
  ApiKeyRecord,
  AuditEvent,
  BlogPost,
  FileItem,
  FileListResponse,
  Notification,
  PlatformConfig,
  ProviderCatalogEntry,
  ProviderConnection,
  PublicShareResponse,
  RemoteEntry,
  SessionInfo,
  SettingRecord,
  ShareRecord,
  SortDirection,
  SortField,
  StorageSummary,
  User,
} from "@/types/api";

export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") || "/api";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(message: string, status: number, code: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** True when retrying the same request could plausibly succeed. */
  get retryable(): boolean {
    return this.status >= 500 || this.status === 429 || this.status === 408;
  }
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...options.headers };
  let body: BodyInit | undefined;

  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      signal: options.signal,
      credentials: "include",
    });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError(
      "We could not reach the server. Check your connection and try again.",
      0,
      "network_error",
    );
  }

  if (options.raw) {
    if (!response.ok) throw await toApiError(response);
    return response as unknown as T;
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const data = (payload ?? {}) as { error?: string; code?: string; details?: unknown; requestId?: string };
    throw new ApiError(
      data.error || defaultMessage(response.status),
      response.status,
      data.code || "request_failed",
      data.details,
      data.requestId,
    );
  }

  return payload as T;
}

async function toApiError(response: Response): Promise<ApiError> {
  const text = await response.text().catch(() => "");
  let payload: { error?: string; code?: string; details?: unknown; requestId?: string } = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  return new ApiError(payload.error || defaultMessage(response.status), response.status, payload.code || "request_failed", payload.details, payload.requestId);
}

function defaultMessage(status: number): string {
  if (status === 401) return "Please sign in to continue.";
  if (status === 403) return "You do not have access to that.";
  if (status === 404) return "That item no longer exists.";
  if (status === 413) return "That file is too large.";
  if (status === 429) return "Too many requests — slow down for a moment.";
  return "Something went wrong. Please try again.";
}

/** Extracts a human-readable message from an unknown thrown value. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Validation errors from the API arrive as `details.errors`. */
export function validationErrors(error: unknown): string[] {
  if (error instanceof ApiError && error.details && typeof error.details === "object") {
    const errors = (error.details as { errors?: unknown }).errors;
    if (Array.isArray(errors)) return errors.map(String);
  }
  return [];
}

export interface UploadHandle {
  promise: Promise<FileItem>;
  abort: () => void;
}

export const api = {
  health: () => request<{ status: string; environment: string; checks: Record<string, string> }>("GET", "/health"),

  config: {
    get: () => request<{ config: PlatformConfig; providers: ProviderCatalogEntry[] }>("GET", "/config"),
  },

  auth: {
    session: () => request<{ user: User | null }>("GET", "/auth/session"),
    me: () => request<{ user: User }>("GET", "/auth/me"),
    register: (body: { email: string; password: string; displayName?: string }) =>
      request<{ user: User }>("POST", "/auth/register", { body }),
    login: (body: { email: string; password: string }) => request<{ user: User }>("POST", "/auth/login", { body }),
    logout: () => request<{ ok: boolean }>("POST", "/auth/logout", { body: {} }),
    updateProfile: (body: { displayName?: string; avatarUrl?: string; timezone?: string; settings?: Record<string, string> }) =>
      request<{ user: User }>("PATCH", "/auth/profile", { body }),
    sessions: () => request<{ sessions: SessionInfo[] }>("GET", "/auth/sessions"),
    revokeSession: (id: string) => request<{ ok: boolean; signedOut: boolean }>("DELETE", `/auth/sessions/${id}`),
    forgotPassword: (email: string) => request<{ ok: boolean; message: string }>("POST", "/auth/password/forgot", { body: { email } }),
    resetPassword: (body: { token: string; password: string }) => request<{ ok: boolean }>("POST", "/auth/password/reset", { body }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ ok: boolean }>("POST", "/auth/password/change", { body }),
    resendVerification: () => request<{ ok: boolean; alreadyVerified?: boolean; emailConfigured?: boolean }>("POST", "/auth/email/resend", { body: {} }),
    verifyEmail: (token: string) => request<{ ok: boolean }>("POST", "/auth/email/verify", { body: { token } }),
    exportData: () => request<Blob>("GET", "/auth/export", { raw: true }).then((r) => r.blob()),
    deleteAccount: (body: { password: string; confirmation: string }) =>
      request<{ ok: boolean; removedObjects: number }>("DELETE", "/auth/account", { body }),
  },

  files: {
    list: (params: {
      folderId?: string | null;
      search?: string;
      kind?: string;
      sort?: SortField;
      direction?: SortDirection;
      starred?: boolean;
      trashed?: boolean;
      limit?: number;
      offset?: number;
      host?: "hosted" | "linked";
    }) => request<FileListResponse>("GET", "/files", { query: params as Record<string, string | number | boolean | undefined | null> }),
    tree: () => request<{ folders: Array<{ id: string; name: string; path: string; parentId: string | null; childCount: number; depth: number }> }>("GET", "/files/tree"),
    recent: (limit = 60) => request<{ files: FileItem[] }>("GET", "/files/recent", { query: { limit } }),
    stats: () =>
      request<{
        summary: StorageSummary;
        providers: Array<{ id: string; provider_name: string; status: string; total_space: number | null; used_space: number | null; priority: number; account_email: string | null; file_count: number; indexed_bytes: number }>;
        usage: Array<{ day: string; uploads: number; downloads: number; deletes: number; shares_created: number; api_calls: number; bytes_uploaded: number; bytes_downloaded: number }>;
        percentUsed: number;
      }>("GET", "/files/stats"),
    get: (id: string) => request<{ file: FileItem }>("GET", `/files/${id}`),
    path: (id: string) => request<{ breadcrumb: Array<{ id: string; name: string; path: string }> }>("GET", `/files/${id}/path`),
    createFolder: (body: { name: string; parentId?: string | null }) => request<{ folder: FileItem }>("POST", "/files/folders", { body }),
    update: (id: string, body: { name?: string; parentId?: string | null; isStarred?: boolean }) =>
      request<{ file: FileItem }>("PATCH", `/files/${id}`, { body }),
    bulk: (body: { action: "trash" | "restore" | "delete" | "star" | "unstar" | "move"; ids: string[]; parentId?: string | null }) =>
      request<{ ok: boolean; affected: number }>("POST", "/files/bulk", { body }),
    remove: (id: string, permanent = false) =>
      request<{ ok: boolean; permanent: boolean; items?: number; removed?: number }>("DELETE", `/files/${id}`, { query: { permanent } }),
    emptyTrash: () => request<{ ok: boolean; removed: number }>("POST", "/files/trash/empty", { body: {} }),
    downloadUrl: (id: string) => buildUrl(`/files/${id}/download`),
    previewUrl: (id: string) => buildUrl(`/files/${id}/preview`),

    /** XHR upload — fetch cannot report upload progress. */
    upload(file: File, parentId: string | null, onProgress?: (percent: number) => void): UploadHandle {
      const xhr = new XMLHttpRequest();
      const promise = new Promise<FileItem>((resolve, reject) => {
        const form = new FormData();
        form.append("file", file);
        if (parentId) form.append("parentId", parentId);

        xhr.open("POST", buildUrl("/files/upload"));
        xhr.withCredentials = true;
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
        };
        xhr.onload = () => {
          let payload: { file?: FileItem; error?: string; code?: string; details?: unknown; requestId?: string } = {};
          try {
            payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
          } catch {
            payload = {};
          }
          if (xhr.status >= 200 && xhr.status < 300 && payload.file) {
            onProgress?.(100);
            resolve(payload.file);
          } else {
            reject(new ApiError(payload.error || defaultMessage(xhr.status), xhr.status, payload.code || "upload_failed", payload.details, payload.requestId));
          }
        };
        xhr.onerror = () => reject(new ApiError("The upload failed. Check your connection and try again.", 0, "network_error"));
        xhr.onabort = () => reject(new ApiError("Upload cancelled.", 0, "aborted"));
        xhr.send(form);
      });
      return { promise, abort: () => xhr.abort() };
    },
  },

  shares: {
    create: (body: {
      fileId: string;
      kind: "link" | "email";
      email?: string;
      permission?: "view" | "edit";
      expiresInDays?: number | null;
      maxDownloads?: number | null;
      password?: string | null;
    }) => request<{ share: ShareRecord; url: string; token: string }>("POST", "/shares", { body }),
    list: (fileId?: string) => request<{ shares: ShareRecord[] }>("GET", "/shares", { query: { fileId } }),
    incoming: () => request<{ shares: ShareRecord[] }>("GET", "/shares/incoming"),
    update: (id: string, body: { permission?: "view" | "edit"; expiresInDays?: number | null }) =>
      request<{ share: ShareRecord }>("PATCH", `/shares/${id}`, { body }),
    revoke: (id: string) => request<{ ok: boolean }>("DELETE", `/shares/${id}`),
    public: {
      get: (token: string) => request<PublicShareResponse>("GET", `/public/shares/${token}`),
      unlock: (token: string, password: string) =>
        request<{ ok: boolean; unlocked: boolean }>("POST", `/public/shares/${token}/unlock`, { body: { password } }),
      downloadUrl: (token: string, fileId?: string) => buildUrl(`/public/shares/${token}/download`, { fileId }),
      previewUrl: (token: string) => buildUrl(`/public/shares/${token}/preview`),
    },
  },

  providers: {
    list: () => request<{ providers: ProviderConnection[] }>("GET", "/providers"),
    catalog: () => request<{ providers: ProviderCatalogEntry[] }>("GET", "/providers/catalog"),
    connect: (provider: string) =>
      request<{ mode: "oauth" | "credentials"; url?: string; displayName?: string; hint?: string }>(
        "POST",
        `/providers/${provider}/connect`,
        { body: {} },
      ),
    credentials: (
      provider: string,
      body: { endpoint?: string; bucket?: string; region?: string; accessKeyId?: string; secretAccessKey?: string; prefix?: string; accountEmail?: string },
    ) => request<{ ok: boolean; verified: boolean }>("POST", `/providers/${provider}/credentials`, { body }),
    reorder: (orderedIds: string[]) => request<{ ok: boolean }>("POST", "/providers/reorder", { body: { orderedIds } }),
    update: (id: string, body: { status?: "connected" | "disconnected"; label?: string }) =>
      request<{ ok: boolean }>("PATCH", `/providers/${id}`, { body }),
    disconnect: (id: string) => request<{ ok: boolean }>("DELETE", `/providers/${id}`),
    browse: (id: string, params: { folderId?: string; prefix?: string }) =>
      request<{ entries: RemoteEntry[]; nextPageToken: string | null; supported: boolean; reason?: string }>(
        "GET",
        `/providers/${id}/browse`,
        { query: params },
      ),
    import: (id: string, body: { folderId?: string | null; prefix?: string }) =>
      request<{ imported: number; supported: boolean }>("POST", `/providers/${id}/import`, { body }),
    fileUrl: (id: string, fileId: string) => buildUrl(`/providers/${id}/file`, { fileId }),
  },

  keys: {
    list: () => request<{ keys: ApiKeyRecord[] }>("GET", "/keys"),
    create: (body: { name: string; permissions: string[]; expiresInDays?: number | null }) =>
      request<{ key: ApiKeyRecord; secret: string }>("POST", "/keys", { body }),
    rotate: (id: string) => request<{ key: ApiKeyRecord; secret: string }>("POST", `/keys/${id}/rotate`, { body: {} }),
    update: (id: string, body: { name?: string; permissions?: string[] }) => request<{ ok: boolean }>("PATCH", `/keys/${id}`, { body }),
    revoke: (id: string) => request<{ ok: boolean }>("DELETE", `/keys/${id}`),
  },

  notifications: {
    list: (unreadOnly = false) =>
      request<{ notifications: Notification[]; unreadCount: number }>("GET", "/notifications", { query: { unread: unreadOnly } }),
    markRead: (ids?: string[]) => request<{ ok: boolean }>("POST", "/notifications/read", { body: { ids } }),
    remove: (id: string) => request<{ ok: boolean }>("DELETE", `/notifications/${id}`),
  },

  activity: {
    list: (limit = 25) => request<{ events: ActivityEvent[] }>("GET", "/activity", { query: { limit } }),
  },

  admin: {
    stats: () => request<AdminOverview>("GET", "/admin/stats"),
    users: (params: { search?: string; page?: number; limit?: number }) =>
      request<{ users: AdminUser[]; total: number; page: number; limit: number }>("GET", "/admin/users", { query: params }),
    updateUser: (id: string, body: { role?: "user" | "admin"; status?: "active" | "suspended"; storageQuotaGb?: number | null }) =>
      request<{ ok: boolean }>("PATCH", `/admin/users/${id}`, { body }),
    settings: () => request<{ settings: SettingRecord[] }>("GET", "/admin/settings"),
    updateSettings: (settings: Record<string, string>) => request<{ ok: boolean; updated: string[] }>("PATCH", "/admin/settings", { body: { settings } }),
    providers: () =>
      request<{
        providers: Array<{
          name: string;
          displayName: string;
          authType: string;
          clientId: string | null;
          hasSecret: boolean;
          scopes: string | null;
          isEnabled: boolean;
          updatedAt: string;
        }>;
      }>("GET", "/admin/providers"),
    updateProvider: (provider: string, body: { clientId?: string | null; clientSecret?: string | null; isEnabled?: boolean; scopes?: string | null }) =>
      request<{ ok: boolean }>("PATCH", `/admin/providers/${provider}`, { body }),
    audit: (params: { page?: number; limit?: number; action?: string; userId?: string }) =>
      request<{ events: AuditEvent[]; total: number; page: number; limit: number }>("GET", "/admin/audit", { query: params }),
    messages: () => request<{ messages: Array<Record<string, unknown>> }>("GET", "/admin/messages"),
    updateMessage: (id: string, status: "new" | "read" | "replied" | "archived") =>
      request<{ ok: boolean }>("PATCH", `/admin/messages/${id}`, { body: { status } }),
    blog: {
      list: () => request<{ posts: Array<BlogPost & { contentMd: string; status: string; createdAt: string }> }>("GET", "/admin/blog"),
      create: (body: { title: string; slug?: string; excerpt?: string; contentMd: string; tags?: string[]; status?: string; author?: string }) =>
        request<{ post: { id: string; slug: string } }>("POST", "/admin/blog", { body }),
      update: (id: string, body: { title?: string; excerpt?: string | null; contentMd?: string; tags?: string[]; status?: "draft" | "published" | "archived" }) =>
        request<{ ok: boolean }>("PATCH", `/admin/blog/${id}`, { body }),
      remove: (id: string) => request<{ ok: boolean }>("DELETE", `/admin/blog/${id}`),
    },
  },

  blog: {
    list: (params: { limit?: number; tag?: string } = {}) =>
      request<{ posts: BlogPost[] }>("GET", "/public/blog", { query: params }),
    get: (slug: string) => request<{ post: BlogPost }>("GET", `/public/blog/${slug}`),
  },

  contact: {
    send: (body: { name: string; email: string; subject?: string; message: string; website?: string }) =>
      request<{ ok: boolean; message: string }>("POST", "/public/contact", { body }),
  },
};

export { request as apiRequest };
