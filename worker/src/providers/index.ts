/**
 * Provider registry + connection manager.
 *
 * Credentials are always encrypted at rest with ENCRYPTION_KEY; access tokens
 * are refreshed transparently and persisted before use.
 */
import type { Env } from "../env";
import { decryptJson, decryptString, encryptJson, encryptString, EncryptionUnavailableError } from "../core/crypto";
import { first, run } from "../core/db";
import { unavailable } from "../core/http";
import { now } from "../core/util";
import { googleDrive } from "./googleDrive";
import { dropbox } from "./dropbox";
import { oneDrive } from "./oneDrive";
import { box } from "./box";
import { amazonS3, backblaze, s3Compatible } from "./s3";
import { yandexDisk } from "./yandexDisk";
import type { Connection, ProviderAdapter, ProviderTokens } from "./types";
import { ProviderError } from "./types";

export const ADAPTERS: ProviderAdapter[] = [googleDrive, dropbox, oneDrive, box, amazonS3, backblaze, s3Compatible, yandexDisk];

export interface CatalogueEntry {
  id: string;
  name: string;
  kind: "oauth" | "credentials";
  description: string;
  docsUrl: string;
  /** Adapter exists and can be used. */
  available: boolean;
  /** Required secrets/credentials are present on this deployment. */
  configured: boolean;
  setupHint?: string;
  credentialFields?: ProviderAdapter["credentialFields"];
}

const DESCRIPTIONS: Record<string, { description: string; docsUrl: string }> = {
  "google-drive": { description: "Personal and Workspace drives, including shared drives.", docsUrl: "https://developers.google.com/drive" },
  dropbox: { description: "Files and folders from Dropbox, including shared folders.", docsUrl: "https://www.dropbox.com/developers" },
  onedrive: { description: "OneDrive personal and business files via Microsoft Graph.", docsUrl: "https://learn.microsoft.com/graph/api/resources/drive" },
  box: { description: "Box cloud content for individuals and teams.", docsUrl: "https://developer.box.com" },
  "amazon-s3": { description: "Any Amazon S3 bucket via access keys. Ideal for archives.", docsUrl: "https://aws.amazon.com/s3/" },
  backblaze: { description: "Backblaze B2 buckets through the S3-compatible API.", docsUrl: "https://www.backblaze.com/b2/docs/" },
  "s3-compatible": { description: "Wasabi, MinIO, Cloudflare R2, DigitalOcean Spaces and friends.", docsUrl: "https://docs.min.io" },
  "yandex-disk": { description: "Yandex Disk storage via a personal OAuth token.", docsUrl: "https://yandex.com/dev/disk" },
};

/** Providers on the roadmap — surfaced so the UI can show them without faking support. */
export const ROADMAP_PROVIDERS = [
  { id: "pcloud", name: "pCloud", description: "pCloud drive support is on the roadmap." },
  { id: "mega", name: "MEGA", description: "End-to-end encrypted MEGA support is on the roadmap." },
  { id: "icedrive", name: "Icedrive", description: "Icedrive support is on the roadmap." },
  { id: "sync", name: "Sync.com", description: "Sync.com support is on the roadmap." },
];

export const getAdapter = (providerId: string): ProviderAdapter | undefined => ADAPTERS.find((adapter) => adapter.id === providerId);

export function requireAdapter(providerId: string): ProviderAdapter {
  const adapter = getAdapter(providerId);
  if (!adapter) throw unavailable(`"${providerId}" is not a supported provider yet.`, "provider_unsupported");
  return adapter;
}

export function catalogue(env: Env): CatalogueEntry[] {
  return ADAPTERS.map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    kind: adapter.kind,
    description: DESCRIPTIONS[adapter.id]?.description || "",
    docsUrl: DESCRIPTIONS[adapter.id]?.docsUrl || "",
    available: true,
    configured: adapter.isConfigured(env),
    setupHint: adapter.isConfigured(env) ? undefined : adapter.missingConfigMessage(),
    credentialFields: adapter.credentialFields,
  }));
}

export interface ProviderRow {
  id: string;
  user_id: string;
  provider_name: string;
  provider_user_email: string | null;
  display_name: string | null;
  status: string;
  total_space: number | null;
  used_space: number | null;
  priority: number;
  account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string | null;
  root_folder_id: string | null;
  encrypted_credentials: string | null;
  config: string;
  last_sync_at: string | null;
  last_error: string | null;
  sync_cursor: string | null;
  file_count: number;
  is_default: number;
  created_at: string;
  updated_at: string;
}

/** Public projection — never exposes tokens. */
export function publicProvider(row: ProviderRow) {
  return {
    id: row.id,
    provider_name: row.provider_name,
    provider_user_email: row.provider_user_email,
    display_name: row.display_name || getAdapter(row.provider_name)?.name || row.provider_name,
    status: row.status,
    total_space: row.total_space,
    used_space: row.used_space,
    priority: row.priority,
    root_folder_id: row.root_folder_id,
    last_sync_at: row.last_sync_at,
    last_error: row.last_error,
    file_count: row.file_count,
    is_default: Boolean(row.is_default),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function assertEncryptionConfigured(env: Env): void {
  if (!env.ENCRYPTION_KEY) {
    throw unavailable(
      "Provider connections are disabled until ENCRYPTION_KEY is set on the Worker. Generate one with: openssl rand -base64 32",
      "encryption_not_configured",
    );
  }
}

export async function persistCredentials(
  env: Env,
  providerRowId: string,
  tokens: ProviderTokens,
  config: Record<string, unknown>,
): Promise<void> {
  assertEncryptionConfigured(env);
  await run(
    env,
    `UPDATE storage_providers
        SET access_token = ?, refresh_token = ?, token_expires_at = ?, scopes = ?, encrypted_credentials = ?, updated_at = ?
      WHERE id = ?`,
    tokens.accessToken ? await encryptString(env, tokens.accessToken) : null,
    tokens.refreshToken ? await encryptString(env, tokens.refreshToken) : null,
    tokens.expiresAt ?? null,
    tokens.scopes ?? null,
    await encryptJson(env, config),
    now(),
    providerRowId,
  );
}

/** Loads a row, decrypts secrets and refreshes the access token when needed. */
export async function openConnection(env: Env, row: ProviderRow): Promise<Connection> {
  const adapter = requireAdapter(row.provider_name);
  assertEncryptionConfigured(env);

  let accessToken = "";
  let refreshToken: string | null = null;
  try {
    if (row.access_token) accessToken = await decryptString(env, row.access_token);
    if (row.refresh_token) refreshToken = await decryptString(env, row.refresh_token);
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) throw error;
    throw new ProviderError("Stored credentials could not be decrypted. Reconnect this provider.", 400, false, true);
  }
  const config = (await decryptJson<Record<string, unknown>>(env, row.encrypted_credentials)) || {};

  const expiresSoon = row.token_expires_at ? new Date(row.token_expires_at).getTime() - Date.now() < 120_000 : false;
  if (expiresSoon && refreshToken && adapter.refreshTokens) {
    try {
      const refreshed = await adapter.refreshTokens(env, refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken ?? refreshToken;
      await run(
        env,
        `UPDATE storage_providers SET access_token = ?, refresh_token = ?, token_expires_at = ?, status = 'connected', last_error = NULL, updated_at = ? WHERE id = ?`,
        await encryptString(env, accessToken),
        refreshToken ? await encryptString(env, refreshToken) : null,
        refreshed.expiresAt ?? null,
        now(),
        row.id,
      );
    } catch (error) {
      await markProviderError(env, row.id, error instanceof Error ? error.message : String(error));
      throw new ProviderError("We could not refresh access to this account. Reconnect it to continue.", 401, false, true);
    }
  }

  return {
    env,
    id: row.id,
    providerId: row.provider_name,
    tokens: { accessToken, refreshToken, expiresAt: row.token_expires_at, scopes: row.scopes },
    config,
    rootFolderId: row.root_folder_id ?? adapter.rootId,
  };
}

export async function loadProviderRow(env: Env, userId: string, providerRowId: string): Promise<ProviderRow | null> {
  return first<ProviderRow>(env, "SELECT * FROM storage_providers WHERE id = ? AND user_id = ?", providerRowId, userId);
}

export async function markProviderError(env: Env, providerRowId: string, message: string): Promise<void> {
  await run(
    env,
    "UPDATE storage_providers SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?",
    message.slice(0, 300),
    now(),
    providerRowId,
  ).catch(() => undefined);
}

export async function markProviderHealthy(env: Env, providerRowId: string): Promise<void> {
  await run(
    env,
    "UPDATE storage_providers SET status = 'connected', last_error = NULL, updated_at = ? WHERE id = ?",
    now(),
    providerRowId,
  ).catch(() => undefined);
}

/** Refreshes quota figures for one connection. */
export async function refreshQuota(env: Env, row: ProviderRow): Promise<{ total: number | null; used: number | null }> {
  const adapter = requireAdapter(row.provider_name);
  const connection = await openConnection(env, row);
  const quota = await adapter.quota(connection);
  await run(
    env,
    "UPDATE storage_providers SET total_space = ?, used_space = ?, last_sync_at = ?, status = 'connected', last_error = NULL, updated_at = ? WHERE id = ?",
    quota.total ?? 0,
    quota.used ?? 0,
    now(),
    now(),
    row.id,
  );
  return quota;
}

/**
 * Caches a bounded slice of a provider's index so unified search works without
 * hitting every provider API on each keystroke.
 */
export async function syncIndex(env: Env, row: ProviderRow, maxEntries = 500): Promise<number> {
  const adapter = requireAdapter(row.provider_name);
  const connection = await openConnection(env, row);
  const queue: (string | null)[] = [row.root_folder_id ?? adapter.rootId ?? null];
  const statements: D1PreparedStatement[] = [];
  let indexed = 0;
  let guard = 0;

  while (queue.length && indexed < maxEntries && guard < 40) {
    guard += 1;
    const folderId = queue.shift() ?? null;
    let cursor: string | null | undefined = null;
    do {
      const page = await adapter.list(connection, folderId, cursor);
      for (const entry of page.entries) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO provider_files(id, user_id, provider_id, remote_id, parent_remote_id, name, path, size, mime_type, is_folder, web_url, modified_at, synced_at)
             VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
             ON CONFLICT(provider_id, remote_id) DO UPDATE SET
               parent_remote_id = excluded.parent_remote_id, name = excluded.name, path = excluded.path,
               size = excluded.size, mime_type = excluded.mime_type, is_folder = excluded.is_folder,
               web_url = excluded.web_url, modified_at = excluded.modified_at, synced_at = excluded.synced_at`,
          ).bind(
            crypto.randomUUID(),
            row.user_id,
            row.id,
            entry.id,
            folderId,
            entry.name,
            entry.path ?? null,
            entry.size ?? 0,
            entry.mimeType ?? null,
            entry.isFolder ? 1 : 0,
            entry.webUrl ?? null,
            entry.modifiedAt ?? null,
          ),
        );
        indexed += 1;
        if (entry.isFolder && queue.length < 20) queue.push(entry.id);
        if (indexed >= maxEntries) break;
      }
      cursor = page.nextCursor;
    } while (cursor && indexed < maxEntries);
  }

  for (let index = 0; index < statements.length; index += 50) {
    await env.DB.batch(statements.slice(index, index + 50));
  }
  await run(
    env,
    "UPDATE storage_providers SET last_sync_at = ?, file_count = ?, status = 'connected', last_error = NULL, updated_at = ? WHERE id = ?",
    now(),
    indexed,
    now(),
    row.id,
  );
  return indexed;
}

export { type Connection, type ProviderAdapter, ProviderError };
