/**
 * Thin, typed HTTP client for the CloudGather API.
 *
 * Responsibilities: attach the session token, normalise the error envelope the
 * Worker returns, expose upload progress (XHR) and browser-friendly downloads.
 */
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "cloudgather_session";

/** Broadcast when the server rejects our credentials so AuthContext can react. */
export const SIGNED_OUT_EVENT = "cloudgather:signed-out";

export const sessionStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage disabled — session lives for this page only */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public code: string = "error",
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when retrying the same request might succeed. */
  get retryable() {
    return this.status === 429 || this.status >= 500;
  }
}

/** Absolute URL for an API path — useful for <img src> and window.open. */
export const apiUrl = (path: string) => `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const authHeaders = (): Record<string, string> => {
  const token = sessionStore.get();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function handleUnauthorized(code: string) {
  if (code === "email_verification_required") return;
  sessionStore.clear();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT));
}

interface ApiInit extends RequestInit {
  /** Retry idempotent requests on 429/5xx (default: GET only, 2 attempts). */
  retries?: number;
}

export async function api<T>(path: string, init: ApiInit = {}): Promise<T> {
  const { retries, ...requestInit } = init;
  const method = (requestInit.method || "GET").toUpperCase();
  const attempts = retries ?? (method === "GET" ? 2 : 0);

  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await request<T>(path, requestInit);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof ApiError && error.retryable;
      if (!retryable || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw lastError;
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers);
  const token = sessionStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "We could not reach CloudGather. Check your connection and try again.", undefined, "network_error");
  }

  if (response.status === 204) return undefined as T;

  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json().catch(() => ({})) : {};

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; code?: string; requestId?: string; details?: unknown } }).error;
    const code = error?.code || "error";
    if (response.status === 401) handleUnauthorized(code);
    throw new ApiError(
      response.status,
      error?.message || `Request failed with status ${response.status}.`,
      error?.requestId,
      code,
      error?.details,
    );
  }

  return payload as T;
}

export interface ProgressEvent {
  loaded: number;
  total: number;
  percent: number;
}

/** POST/PUT with real upload progress. Falls back to the message the API returns. */
export function apiUpload<T>(
  path: string,
  body: FormData | Blob,
  options: { method?: string; onProgress?: (progress: ProgressEvent) => void; signal?: AbortSignal; contentType?: string } = {},
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method || "POST", `${API_URL}${path}`, true);
    const token = sessionStore.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (options.contentType) xhr.setRequestHeader("Content-Type", options.contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !options.onProgress) return;
      options.onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(99, Math.round((event.loaded / event.total) * 100)),
      });
    };

    xhr.onload = () => {
      let payload: { error?: { message?: string; code?: string; requestId?: string } } = {};
      try {
        payload = JSON.parse(xhr.responseText || "{}");
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.({ loaded: 1, total: 1, percent: 100 });
        resolve(payload as T);
        return;
      }
      const code = payload.error?.code || "error";
      if (xhr.status === 401) handleUnauthorized(code);
      reject(new ApiError(xhr.status, payload.error?.message || "Upload failed.", payload.error?.requestId, code));
    };

    xhr.onerror = () => reject(new ApiError(0, "The upload was interrupted. Check your connection and try again.", undefined, "network_error"));
    xhr.onabort = () => reject(new ApiError(0, "Upload cancelled.", undefined, "aborted"));

    options.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(body);
  });
}

/** Streams an authenticated file to disk with the server-provided filename. */
export async function apiDownload(path: string, fallbackName = "download"): Promise<void> {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new ApiError(response.status, payload.error?.message || "Could not download this file.");
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1].replace(/"$/, "")) : fallbackName;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Fetches an authenticated resource as an object URL (previews, avatars). */
export async function apiObjectUrl(path: string): Promise<string | null> {
  const response = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!response.ok) return null;
  return URL.createObjectURL(await response.blob());
}

/** Human-readable message for anything thrown by the client. */
export const errorMessage = (error: unknown, fallback = "Something went wrong.") =>
  error instanceof ApiError || error instanceof Error ? error.message || fallback : fallback;
