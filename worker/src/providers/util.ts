/** Shared HTTP helpers for provider adapters. */
import { ProviderError } from "./types";

export interface RequestOptions extends RequestInit {
  /** Parse and return JSON (default true). */
  json?: boolean;
  timeoutMs?: number;
}

export async function providerFetch(url: string, options: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 30_000, ...init } = options;
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw new ProviderError(`Could not reach the provider: ${String(error).slice(0, 160)}`, 504, true);
  }
  if (response.ok) return response;

  const body = (await response.text().catch(() => "")).slice(0, 400);
  if (response.status === 401 || response.status === 403) {
    throw new ProviderError(
      `The provider rejected our credentials (${response.status}). Reconnect the account to continue.`,
      response.status === 401 ? 401 : 403,
      false,
      true,
    );
  }
  if (response.status === 404) throw new ProviderError("The requested item no longer exists in the provider account.", 404);
  if (response.status === 429) throw new ProviderError("The provider is rate limiting us. Try again shortly.", 429, true);
  if (response.status >= 500) throw new ProviderError(`Provider is unavailable (${response.status}).`, 502, true);
  throw new ProviderError(`Provider request failed (${response.status}): ${body}`, 400);
}

export async function fetchJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const response = await providerFetch(url, options);
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const expiresInToIso = (seconds: unknown): string | null => {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? new Date(Date.now() + value * 1000).toISOString() : null;
};

export function buildUrl(base: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export const formBody = (params: Record<string, string | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined) as [string, string][]).toString();

/** Normalizes a POSIX-ish remote path. */
export function joinPath(parent: string | null | undefined, name: string): string {
  const base = (parent || "").replace(/\/+$/, "");
  return `${base}/${name}`.replace(/\/{2,}/g, "/");
}
