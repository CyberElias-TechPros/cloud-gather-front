/**
 * Connected drives: catalogue, OAuth handshake, credential storage and sync.
 *
 * Two rules keep this honest:
 *  1. A connection is only created after the provider has actually accepted the
 *     credentials (an OAuth token exchange, or a live probe for key-based storage).
 *  2. Providers without an adapter report `supported: false` instead of returning
 *     invented file lists.
 */

import { ADAPTERS, s3DownloadUrl, s3List, type ProviderAccount, type RemoteEntry } from "./providers/adapters";
import { probeBucket, type S3Connection } from "./providers/s3";
import { createSignedValue, readSignedValue, seal, unseal } from "./crypto";
import { all, first, newId, nowIso, parseJson, run, stringifyJson } from "./db";
import { ApiError, badRequest, forbidden, notFound } from "./http";
import type { Env, ProviderConfigRow, ProviderRow, UserRow } from "../types";

export interface ProviderCatalogEntry {
  name: string;
  displayName: string;
  authType: "oauth" | "credentials" | "managed";
  configured: boolean;
  enabled: boolean;
  supportsBrowsing: boolean;
  accountEmail: string | null;
  connected: boolean;
}

export interface ProviderDto {
  id: string;
  providerName: string;
  displayName: string;
  status: ProviderRow["status"];
  accountEmail: string | null;
  accountLabel: string | null;
  totalSpace: number | null;
  usedSpace: number | null;
  priority: number;
  authType: string;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  supportsBrowsing: boolean;
  createdAt: string;
  fileCount: number;
  indexedBytes: number;
}

export const MANAGED_PROVIDER = "cloudgather";

function encryptionSecret(env: Env): string {
  return env.TOKEN_ENCRYPTION_KEY || env.SESSION_SECRET || "";
}

export function supportsBrowsing(providerName: string): boolean {
  if (providerName === MANAGED_PROVIDER) return true;
  return Boolean(ADAPTERS[providerName]?.supported) || isS3Compatible(providerName);
}

export function isS3Compatible(providerName: string): boolean {
  return ["amazon-s3", "backblaze-b2", "wasabi", "custom-s3", "cloudflare-r2"].includes(providerName);
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export async function listProviderConfigs(env: Env): Promise<ProviderConfigRow[]> {
  return all<ProviderConfigRow>(env.DB, `SELECT * FROM provider_configs ORDER BY is_enabled DESC, display_name ASC`);
}

export async function getProviderConfig(env: Env, name: string): Promise<ProviderConfigRow | null> {
  return first<ProviderConfigRow>(env.DB, `SELECT * FROM provider_configs WHERE provider_name = ?`, name);
}

export async function catalog(env: Env, userId: string | null): Promise<ProviderCatalogEntry[]> {
  const [configs, connections] = await Promise.all([
    listProviderConfigs(env),
    userId ? all<ProviderRow>(env.DB, `SELECT * FROM providers WHERE user_id = ?`, userId) : Promise.resolve([]),
  ]);
  const byName = new Map(connections.map((row) => [row.provider_name, row]));

  return configs.map((config) => {
    const connection = byName.get(config.provider_name);
    return {
      name: config.provider_name,
      displayName: config.display_name,
      authType: config.auth_type,
      configured: Boolean(config.is_configured),
      enabled: Boolean(config.is_enabled),
      supportsBrowsing: supportsBrowsing(config.provider_name),
      accountEmail: connection?.account_email ?? null,
      connected: connection?.status === "connected",
    };
  });
}

export async function listConnections(env: Env, userId: string): Promise<ProviderRow[]> {
  return all<ProviderRow>(env.DB, `SELECT * FROM providers WHERE user_id = ? ORDER BY priority ASC, created_at ASC`, userId);
}

export async function toProviderDto(env: Env, row: ProviderRow): Promise<ProviderDto> {
  const counts = await first<{ count: number; bytes: number }>(
    env.DB,
    `SELECT COUNT(*) AS count, COALESCE(SUM(size), 0) AS bytes FROM files WHERE provider_id = ? AND trashed_at IS NULL AND is_folder = 0`,
    row.id,
  );
  const config = await getProviderConfig(env, row.provider_name);
  return {
    id: row.id,
    providerName: row.provider_name,
    displayName: row.display_name,
    status: row.status,
    accountEmail: row.account_email,
    accountLabel: row.account_label,
    totalSpace: row.total_space,
    usedSpace: row.used_space,
    priority: row.priority,
    authType: config?.auth_type ?? (row.provider_name === MANAGED_PROVIDER ? "managed" : "oauth"),
    tokenExpiresAt: row.token_expires_at,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    supportsBrowsing: supportsBrowsing(row.provider_name),
    createdAt: row.created_at,
    fileCount: counts?.count ?? 0,
    indexedBytes: counts?.bytes ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/** The managed pool every account starts with — files stored by CloudGather itself. */
export async function ensureManagedProvider(env: Env, user: UserRow): Promise<ProviderRow> {
  const existing = await first<ProviderRow>(
    env.DB,
    `SELECT * FROM providers WHERE user_id = ? AND provider_name = ?`,
    user.id,
    MANAGED_PROVIDER,
  );
  if (existing) return existing;

  const id = newId("prv");
  await run(
    env.DB,
    `INSERT INTO providers (id, user_id, provider_name, display_name, status, account_email, account_label, priority, metadata, last_synced_at)
     VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?)`,
    id,
    user.id,
    MANAGED_PROVIDER,
    "CloudGather Storage",
    user.email,
    "Primary storage pool",
    0,
    stringifyJson({ bucket: env.FILES ? "r2" : "none" }),
    nowIso(),
  );
  const created = await first<ProviderRow>(env.DB, `SELECT * FROM providers WHERE id = ?`, id);
  if (!created) throw new ApiError("internal_error", "Could not create the primary storage pool.");
  return created;
}

export interface UpsertConnectionInput {
  providerName: string;
  displayName?: string;
  authType: "oauth" | "credentials";
  account?: ProviderAccount | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  scope?: string | null;
  metadata?: Record<string, unknown>;
  label?: string | null;
}

export async function upsertConnection(env: Env, user: UserRow, input: UpsertConnectionInput): Promise<ProviderRow> {
  const secret = encryptionSecret(env);
  if (!secret) throw new ApiError("internal_error", "Token encryption is not configured, so drives cannot be connected.");

  const config = await getProviderConfig(env, input.providerName);
  const displayName = input.displayName ?? config?.display_name ?? input.providerName;
  const accessToken = input.accessToken ? await seal(input.accessToken, secret) : null;
  const refreshToken = input.refreshToken ? await seal(input.refreshToken, secret) : null;
  const existing = await first<ProviderRow>(
    env.DB,
    `SELECT * FROM providers WHERE user_id = ? AND provider_name = ?`,
    user.id,
    input.providerName,
  );

  const account = input.account ?? null;
  const timestamp = nowIso();

  if (existing) {
    await run(
      env.DB,
      `UPDATE providers
          SET display_name = ?, status = 'connected', account_email = ?, account_label = ?, total_space = ?, used_space = ?,
              access_token = COALESCE(?, access_token), refresh_token = COALESCE(?, refresh_token),
              token_expires_at = ?, scope = ?, metadata = ?, last_error = NULL, updated_at = ?
        WHERE id = ?`,
      displayName,
      account?.email ?? existing.account_email,
      input.label ?? account?.displayName ?? existing.account_label,
      account?.totalSpace ?? existing.total_space,
      account?.usedSpace ?? existing.used_space,
      accessToken,
      refreshToken,
      input.expiresAt ?? null,
      input.scope ?? existing.scope,
      stringifyJson({ ...parseJson<Record<string, unknown>>(existing.metadata, {}), ...(input.metadata ?? {}) }),
      timestamp,
      existing.id,
    );
    return (await first<ProviderRow>(env.DB, `SELECT * FROM providers WHERE id = ?`, existing.id)) as ProviderRow;
  }

  const id = newId("prv");
  const priorityRow = await first<{ next: number }>(
    env.DB,
    `SELECT COALESCE(MAX(priority), 0) + 1 AS next FROM providers WHERE user_id = ?`,
    user.id,
  );

  await run(
    env.DB,
    `INSERT INTO providers (id, user_id, provider_name, display_name, status, account_email, account_label,
                            total_space, used_space, priority, access_token, refresh_token, token_expires_at, scope, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    user.id,
    input.providerName,
    displayName,
    account?.email ?? null,
    input.label ?? account?.displayName ?? null,
    account?.totalSpace ?? null,
    account?.usedSpace ?? null,
    priorityRow?.next ?? 1,
    accessToken,
    refreshToken,
    input.expiresAt ?? null,
    input.scope ?? null,
    stringifyJson(input.metadata ?? {}),
    timestamp,
    timestamp,
  );

  const created = await first<ProviderRow>(env.DB, `SELECT * FROM providers WHERE id = ?`, id);
  if (!created) throw new ApiError("internal_error", "The drive could not be connected.");
  return created;
}

export async function disconnectProvider(env: Env, user: UserRow, providerId: string): Promise<ProviderRow> {
  const provider = await first<ProviderRow>(env.DB, `SELECT * FROM providers WHERE id = ? AND user_id = ?`, providerId, user.id);
  if (!provider) throw notFound("That drive is not connected to your account.");
  if (provider.provider_name === MANAGED_PROVIDER) {
    throw badRequest("CloudGather Storage is your primary pool and cannot be disconnected.");
  }

  // Index entries for a disconnected drive are removed, but files already
  // imported into CloudGather storage are left exactly where they are.
  await run(env.DB, `DELETE FROM files WHERE user_id = ? AND provider_id = ? AND storage_key IS NULL`, user.id, providerId);
  await run(env.DB, `DELETE FROM providers WHERE id = ?`, providerId);
  return provider;
}

export async function reorderProviders(env: Env, user: UserRow, orderedIds: string[]): Promise<void> {
  const owned = await all<{ id: string }>(env.DB, `SELECT id FROM providers WHERE user_id = ?`, user.id);
  const ownedIds = new Set(owned.map((row) => row.id));
  const statements = orderedIds
    .filter((id) => ownedIds.has(id))
    .map((id, index) => env.DB.prepare(`UPDATE providers SET priority = ?, updated_at = ? WHERE id = ?`).bind(index, nowIso(), id));
  if (statements.length > 0) await env.DB.batch(statements);
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export interface ProviderCredentials {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  connection: S3Connection | null;
}

/** Opens the sealed credentials for a connection. */
export async function providerCredentials(env: Env, provider: ProviderRow): Promise<ProviderCredentials> {
  const secret = encryptionSecret(env);
  const accessToken = await unseal(provider.access_token, secret);
  const refreshToken = await unseal(provider.refresh_token, secret);
  const metadata = parseJson<Record<string, string>>(provider.metadata, {});

  let connection: S3Connection | null = null;
  if (isS3Compatible(provider.provider_name) && metadata.endpoint && metadata.bucket) {
    connection = {
      endpoint: metadata.endpoint,
      bucket: metadata.bucket,
      region: metadata.region || "us-east-1",
      credentials: {
        accessKeyId: metadata.accessKeyId ?? "",
        secretAccessKey: accessToken ?? "",
        sessionToken: metadata.sessionToken || undefined,
      },
      prefix: metadata.prefix || undefined,
    };
  }

  return { accessToken, refreshToken, expiresAt: provider.token_expires_at, connection };
}

export interface OAuthStart {
  url: string;
  provider: string;
}

/**
 * Builds the provider's consent URL with a signed, short-lived state value, so
 * the callback can be validated without server-side session storage.
 */
export async function beginOAuth(env: Env, user: UserRow, providerName: string): Promise<OAuthStart> {
  const config = await getProviderConfig(env, providerName);
  if (!config) throw notFound(`Unknown provider "${providerName}".`);
  if (config.auth_type !== "oauth") throw badRequest(`${config.display_name} is connected with credentials, not OAuth.`);
  if (!config.is_enabled) throw forbidden(`${config.display_name} connections are disabled on this deployment.`);
  if (!config.client_id || !config.client_secret) {
    // Provider-specific environment variables are an equally valid configuration.
    const fromEnv = envCredentials(env, providerName);
    if (!fromEnv) {
      throw new ApiError(
        "bad_request",
        `${config.display_name} is not configured on this deployment yet. An administrator can add OAuth credentials in Admin → Providers.`,
      );
    }
    return buildAuthorizeUrl(env, user, config, fromEnv.clientId);
  }
  return buildAuthorizeUrl(env, user, config, config.client_id);
}

async function buildAuthorizeUrl(env: Env, user: UserRow, config: ProviderConfigRow, clientId: string): Promise<OAuthStart> {
  if (!config.authorize_url) throw badRequest(`${config.display_name} does not have an authorization endpoint configured.`);
  const secretKey = env.SESSION_SECRET || "insecure-development-secret";
  const state = await createSignedValue({ userId: user.id, provider: config.provider_name }, secretKey, 900);
  const redirectUri = callbackUrl(env, config.provider_name);

  const url = new URL(config.authorize_url);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (config.scopes) url.searchParams.set("scope", config.scopes);
  if (config.provider_name === "dropbox") {
    url.searchParams.set("token_access_type", "offline");
  }
  if (config.provider_name === "google-drive") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }

  return { url: url.toString(), provider: config.provider_name };
}

/**
 * The callback is routed back through the app origin (`/api` is proxied to this
 * Worker), which keeps the OAuth redirect same-origin and avoids CORS entirely.
 */
export function callbackUrl(env: Env, providerName: string): string {
  const base = (env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
  return `${base}/api/providers/${providerName}/callback`;
}

function envCredentials(env: Env, providerName: string): { clientId: string; clientSecret: string } | null {
  const map: Record<string, [string | undefined, string | undefined]> = {
    "google-drive": [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
    dropbox: [env.DROPBOX_CLIENT_ID, env.DROPBOX_CLIENT_SECRET],
    onedrive: [env.MICROSOFT_CLIENT_ID, env.MICROSOFT_CLIENT_SECRET],
    box: [env.BOX_CLIENT_ID, env.BOX_CLIENT_SECRET],
  };
  const pair = map[providerName];
  if (!pair || !pair[0] || !pair[1]) return null;
  return { clientId: pair[0], clientSecret: pair[1] };
}

export interface OAuthCallbackResult {
  provider: ProviderRow;
  providerName: string;
}

export async function completeOAuth(env: Env, code: string, state: string): Promise<OAuthCallbackResult> {
  const secretKey = env.SESSION_SECRET || "insecure-development-secret";
  const decoded = await readSignedValue<{ userId: string; provider: string }>(state, secretKey);
  if (!decoded) throw badRequest("That sign-in link has expired. Start the connection again from Providers.");

  const user = await first<UserRow>(env.DB, `SELECT * FROM users WHERE id = ?`, decoded.userId);
  if (!user) throw notFound("Your account could not be found.");

  const config = await getProviderConfig(env, decoded.provider);
  if (!config) throw notFound("Unknown provider.");

  const credentials = envCredentials(env, decoded.provider);
  const clientId = config.client_id ?? credentials?.clientId ?? "";
  const clientSecret = config.client_secret ? (await unseal(config.client_secret, encryptionSecret(env))) ?? "" : credentials?.clientSecret ?? "";
  if (!clientId || !clientSecret || !config.token_url) {
    throw new ApiError("bad_request", `${config.display_name} is not fully configured on this deployment.`);
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: callbackUrl(env, decoded.provider),
    grant_type: "authorization_code",
  });

  const response = await fetch(config.token_url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[providers] token exchange failed for ${decoded.provider}: ${response.status} ${detail.slice(0, 200)}`);
    throw new ApiError("bad_request", `${config.display_name} rejected the authorization. Please try connecting again.`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!payload.access_token) {
    throw new ApiError("bad_request", `${config.display_name} did not return an access token.`);
  }

  const adapter = ADAPTERS[decoded.provider];
  let account: ProviderAccount | null = null;
  if (adapter?.account) {
    try {
      account = await adapter.account(payload.access_token);
    } catch (error) {
      // A connection without profile details is still usable.
      console.warn(`[providers] account lookup failed for ${decoded.provider}`, error instanceof Error ? error.message : error);
    }
  }

  const connection = await upsertConnection(env, user, {
    providerName: decoded.provider,
    authType: "oauth",
    account,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : null,
    scope: payload.scope ?? config.scopes ?? null,
  });

  return { provider: connection, providerName: decoded.provider };
}

// ---------------------------------------------------------------------------
// Remote browsing and import
// ---------------------------------------------------------------------------

export interface BrowseResult {
  entries: RemoteEntry[];
  nextPageToken: string | null;
  supported: boolean;
  reason?: string;
}

export async function browseRemote(
  env: Env,
  provider: ProviderRow,
  options: { folderId?: string | null; prefix?: string | null } = {},
): Promise<BrowseResult> {
  const credentials = await providerCredentials(env, provider);

  if (isS3Compatible(provider.provider_name)) {
    if (!credentials.connection) {
      return { entries: [], nextPageToken: null, supported: false, reason: "This connection is missing its bucket details. Reconnect it to browse." };
    }
    const result = await s3List(credentials.connection, options.prefix ?? options.folderId ?? undefined);
    return { ...result, supported: true };
  }

  const adapter = ADAPTERS[provider.provider_name];
  if (!adapter || !adapter.supported || !adapter.list) {
    return {
      entries: [],
      nextPageToken: null,
      supported: false,
      reason: `${provider.display_name} does not publish a file-listing API this deployment can use. Files stored in CloudGather storage remain fully available.`,
    };
  }
  if (!credentials.accessToken) {
    return { entries: [], nextPageToken: null, supported: false, reason: "Stored credentials could not be read. Reconnect this drive." };
  }

  const result = await adapter.list(credentials.accessToken, options.folderId ?? null);
  return { ...result, supported: true };
}

/** Streams a remote file through the Worker so the browser never sees a token. */
export async function fetchRemoteFile(env: Env, provider: ProviderRow, fileId: string): Promise<Response> {
  const credentials = await providerCredentials(env, provider);

  if (isS3Compatible(provider.provider_name)) {
    if (!credentials.connection) throw badRequest("This connection is missing its bucket details.");
    const url = await s3DownloadUrl(credentials.connection, fileId);
    const response = await fetch(url);
    if (!response.ok) throw new ApiError("bad_request", "The storage provider would not return that object.");
    return response;
  }

  const adapter = ADAPTERS[provider.provider_name];
  if (!adapter?.download || !credentials.accessToken) {
    throw new ApiError("conflict", `${provider.display_name} downloading is not supported on this deployment.`);
  }
  return adapter.download(credentials.accessToken, fileId);
}

export async function probeCredentials(
  env: Env,
  providerName: string,
  metadata: Record<string, string>,
): Promise<{ ok: boolean; error?: string; account?: ProviderAccount }> {
  if (isS3Compatible(providerName)) {
    const connection: S3Connection = {
      endpoint: metadata.endpoint,
      bucket: metadata.bucket,
      region: metadata.region || "us-east-1",
      credentials: {
        accessKeyId: metadata.accessKeyId,
        secretAccessKey: metadata.secretAccessKey,
        sessionToken: metadata.sessionToken || undefined,
      },
    };
    const result = await probeBucket(connection);
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  return { ok: false, error: `${providerName} does not support credential connections.` };
}

export async function markProviderError(env: Env, providerId: string, message: string): Promise<void> {
  await run(env.DB, `UPDATE providers SET status = 'error', last_error = ?, updated_at = ? WHERE id = ?`, message.slice(0, 300), nowIso(), providerId);
}

export async function markProviderSynced(env: Env, providerId: string): Promise<void> {
  await run(env.DB, `UPDATE providers SET last_synced_at = ?, status = 'connected', last_error = NULL, updated_at = ? WHERE id = ?`, nowIso(), nowIso(), providerId);
}
