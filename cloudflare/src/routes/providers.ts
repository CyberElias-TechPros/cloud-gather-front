/**
 * Connected drives.
 *
 * Connecting is always verified against the real provider: an OAuth token
 * exchange, or a live probe for key-based object storage. Browsing and importing
 * only work where an adapter exists — everything else reports `supported: false`
 * with the reason, rather than returning invented listings.
 */

import { currentUser, requireScope } from "../lib/auth";
import { seal } from "../lib/crypto";
import { all, first, isoAfter, newId, nowIso, parseJson, run, stringifyJson } from "../lib/db";
import { badRequest, created, forbidden, json, notFound, redirect, type Ctx } from "../lib/http";
import { record } from "../lib/events";
import { booleanSetting, getSettings, numericSetting } from "../lib/settings";
import { optionalString, queryValue, requireString } from "../lib/validate";
import {
  MANAGED_PROVIDER,
  beginOAuth,
  browseRemote,
  catalog,
  completeOAuth,
  disconnectProvider,
  ensureManagedProvider,
  fetchRemoteFile,
  getProviderConfig,
  isS3Compatible,
  listConnections,
  markProviderError,
  markProviderSynced,
  probeCredentials,
  providerCredentials,
  reorderProviders,
  supportsBrowsing,
  toProviderDto,
  upsertConnection,
} from "../lib/providers";
import { createFile, toFileDto } from "../lib/files";
import { contentDisposition } from "../lib/http";
import type { AuthUser, Env, ProviderRow, UserRow } from "../types";

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------

export async function list(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  await ensureManagedProvider(ctx.env, user);

  const connections = await listConnections(ctx.env, user.id);
  const dtos = await Promise.all(connections.map((row) => toProviderDto(ctx.env, row)));
  return json({ providers: dtos });
}

export async function catalogRoute(ctx: Ctx): Promise<Response> {
  const auth = ctx.state.auth as AuthUser | undefined;
  return json({ providers: await catalog(ctx.env, auth?.user.id ?? null) });
}

export async function statsRoute(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const connections = await listConnections(ctx.env, user.id);
  const used = await first<{ total: number | null }>(
    ctx.env.DB,
    `SELECT SUM(size) AS total FROM files WHERE user_id = ? AND trashed_at IS NULL AND is_folder = 0`,
    user.id,
  );
  const quota = user.storage_quota_bytes;
  const totalRemote = connections.reduce((total, row) => total + (row.total_space ?? 0), 0);
  const usedRemote = connections.reduce((total, row) => total + (row.used_space ?? 0), 0);

  return json({
    storage: {
      usedBytes: used?.total ?? 0,
      quotaBytes: quota,
      percentUsed: quota > 0 ? Math.min(100, ((used?.total ?? 0) / quota) * 100) : 0,
      remoteTotalBytes: totalRemote || null,
      remoteUsedBytes: usedRemote || null,
    },
    providers: await Promise.all(connections.map((row) => toProviderDto(ctx.env, row))),
  });
}

// ---------------------------------------------------------------------------
// Connecting
// ---------------------------------------------------------------------------

export async function connect(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const settings = await getSettings(ctx.env);
  if (!booleanSetting(settings, "provider_sync_enabled", true)) {
    throw forbidden("Connecting drives is disabled on this deployment.");
  }

  const providerName = ctx.params.provider;
  const connections = await listConnections(ctx.env, user.id);
  const limit = numericSetting(settings, "max_providers_per_user", 12);
  if (connections.length >= limit) {
    throw forbidden(`You have reached the limit of ${limit} connected drives. Disconnect one to add another.`);
  }

  const config = await getProviderConfig(ctx.env, providerName);
  if (!config) throw notFound(`"${providerName}" is not a supported provider.`);
  if (config.auth_type === "managed") {
    const provider = await ensureManagedProvider(ctx.env, user);
    return json({ mode: "managed", provider: await toProviderDto(ctx.env, provider) });
  }
  if (config.auth_type === "credentials") {
    return json({
      mode: "credentials",
      displayName: config.display_name,
      hint: isS3Compatible(providerName)
        ? "Provide the endpoint, bucket and an access key with read access to that bucket."
        : "Provide the connection details issued by the provider.",
    });
  }

  const start = await beginOAuth(ctx.env, user, providerName);
  await record(ctx.env, { action: "provider.connect_started", user, resourceType: "provider", resourceId: providerName, ctx });
  return json({ mode: "oauth", url: start.url, displayName: config.display_name });
}

/** Handles the OAuth redirect from the provider, then returns the user to the app. */
export async function callback(ctx: Ctx): Promise<Response> {
  const providerName = ctx.params.provider;
  const base = (ctx.env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
  const error = queryValue(ctx.url, "error");
  const code = queryValue(ctx.url, "code");
  const state = queryValue(ctx.url, "state");

  if (error) {
    return redirect(`${base}/providers?connect=error&provider=${providerName}&reason=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return redirect(`${base}/providers?connect=error&provider=${providerName}&reason=missing_code`);
  }

  try {
    const result = await completeOAuth(ctx.env, code, state);
    const user = await first<UserRow>(ctx.env.DB, `SELECT * FROM users WHERE id = ?`, result.provider.user_id);
    if (user) {
      await record(ctx.env, {
        action: "provider.connected",
        user,
        resourceType: "provider",
        resourceId: result.provider.id,
        ctx,
        details: { provider: result.providerName },
      });
    }
    return redirect(`${base}/providers?connect=success&provider=${result.providerName}`);
  } catch (failure) {
    const reason = failure instanceof Error ? failure.message : "connection_failed";
    console.warn(`[providers] callback failed for ${providerName}: ${reason}`);
    return redirect(`${base}/providers?connect=error&provider=${providerName}&reason=${encodeURIComponent(reason.slice(0, 120))}`);
  }
}

/**
 * Key-based connections (S3, Backblaze B2, Wasabi, custom S3). Credentials are
 * probed against the live endpoint before anything is stored.
 */
export async function credentials(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const providerName = ctx.params.provider;
  const config = await getProviderConfig(ctx.env, providerName);
  if (!config) throw notFound(`"${providerName}" is not a supported provider.`);
  if (config.auth_type !== "credentials") throw badRequest(`${config.display_name} is connected with OAuth, not credentials.`);

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  const metadata: Record<string, string> = {
    endpoint: requireString(input, "endpoint", { label: "Endpoint", max: 300 }).replace(/\/+$/, ""),
    bucket: requireString(input, "bucket", { label: "Bucket", max: 200 }),
    region: optionalString(input, "region", { max: 60 }) ?? "us-east-1",
    accessKeyId: requireString(input, "accessKeyId", { label: "Access key", max: 200 }),
    prefix: optionalString(input, "prefix", { max: 200 }) ?? "",
  };
  const secretAccessKey = requireString(input, "secretAccessKey", { label: "Secret key", max: 400 });

  if (!/^https?:\/\//.test(metadata.endpoint)) {
    throw badRequest("The endpoint must start with https:// (an S3-compatible API URL).");
  }
  // Private-network endpoints would turn this endpoint into an SSRF primitive.
  if (/^https?:\/\/(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(metadata.endpoint)) {
    throw badRequest("Private network endpoints are not allowed.");
  }

  const probe = await probeCredentials(ctx.env, providerName, { ...metadata, secretAccessKey });
  if (!probe.ok) {
    return json(
      {
        error: "Those credentials were rejected by the storage provider, so nothing was saved.",
        code: "credentials_invalid",
        details: { reason: probe.error ?? "unknown" },
      },
      { status: 400 },
    );
  }

  const secret = ctx.env.TOKEN_ENCRYPTION_KEY || ctx.env.SESSION_SECRET || "";
  const connection = await upsertConnection(ctx.env, user, {
    providerName,
    authType: "credentials",
    label: `${metadata.bucket} (${metadata.region})`,
    accessToken: secretAccessKey,
    metadata,
  });

  await record(ctx.env, {
    action: "provider.connected",
    user,
    resourceType: "provider",
    resourceId: connection.id,
    ctx,
    details: { provider: providerName, bucket: metadata.bucket, verified: true },
  });

  return created({ ok: true, verified: true, provider: await toProviderDto(ctx.env, connection) });
}

export async function update(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const provider = await first<ProviderRow>(ctx.env.DB, `SELECT * FROM providers WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!provider) throw notFound("That drive is not connected to your account.");

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const label = optionalString(input, "label", { max: 120 });
  const status = optionalString(input, "status", { max: 20 });

  if (status && !["connected", "disconnected"].includes(status)) throw badRequest("Unsupported status.");

  await run(
    ctx.env.DB,
    `UPDATE providers SET account_label = COALESCE(?, account_label), status = COALESCE(?, status), updated_at = ? WHERE id = ?`,
    label ?? null,
    status ?? null,
    nowIso(),
    provider.id,
  );

  return json({ provider: await toProviderDto(ctx.env, (await first<ProviderRow>(ctx.env.DB, `SELECT * FROM providers WHERE id = ?`, provider.id)) as ProviderRow) });
}

export async function disconnect(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const provider = await disconnectProvider(ctx.env, user, ctx.params.id);
  await record(ctx.env, {
    action: "provider.disconnected",
    user,
    resourceType: "provider",
    resourceId: provider.id,
    ctx,
    details: { provider: provider.provider_name },
  });
  return json({ ok: true, provider: provider.provider_name });
}

export async function reorder(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const orderedIds = Array.isArray(input.orderedIds) ? input.orderedIds.map(String) : [];
  if (orderedIds.length === 0) throw badRequest("Provide the drive order as orderedIds.");
  await reorderProviders(ctx.env, user, orderedIds);
  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// Browsing and importing
// ---------------------------------------------------------------------------

export async function browse(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const provider = await first<ProviderRow>(ctx.env.DB, `SELECT * FROM providers WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!provider) throw notFound("That drive is not connected to your account.");
  if (provider.status !== "connected") throw badRequest("Reconnect this drive before browsing it.");

  try {
    const result = await browseRemote(ctx.env, provider, {
      folderId: queryValue(ctx.url, "folderId"),
      prefix: queryValue(ctx.url, "prefix"),
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The drive could not be read.";
    await markProviderError(ctx.env, provider.id, message);
    throw badRequest(`We could not read that drive: ${message.slice(0, 200)}`);
  }
}

/**
 * Queues a background import. Each file becomes an independent job so a single
 * failure cannot stall a large folder, and the worker handles downloads and
 * storage writes outside the request.
 */
export async function importFiles(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const settings = await getSettings(ctx.env);
  if (!booleanSetting(settings, "provider_sync_enabled", true)) {
    throw forbidden("Importing from connected drives is disabled on this deployment.");
  }

  const provider = await first<ProviderRow>(ctx.env.DB, `SELECT * FROM providers WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!provider) throw notFound("That drive is not connected to your account.");

  const input = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;
  const parentId = (input.parentId as string | null) ?? null;
  const folderId = optionalString(input, "folderId", { max: 400 }) ?? null;
  const prefix = optionalString(input, "prefix", { max: 400 }) ?? null;

  const listing = await browseRemote(ctx.env, provider, { folderId, prefix });
  if (!listing.supported) throw badRequest(listing.reason ?? "This drive does not support browsing.");

  const selectedIds = Array.isArray(input.fileIds) ? input.fileIds.map(String) : null;
  const candidates = listing.entries
    .filter((entry) => !entry.isFolder && (selectedIds ? selectedIds.includes(entry.id) : true))
    .slice(0, 50);

  if (candidates.length === 0) throw badRequest("There is nothing to import in that location.");

  for (const entry of candidates) {
    await ctx.env.JOBS.send({
      type: "provider.import",
      userId: user.id,
      providerId: provider.id,
      providerFileId: entry.id,
      name: entry.name,
      size: entry.size,
      mimeType: entry.mimeType,
      parentId,
    });
  }

  await markProviderSynced(ctx.env, provider.id);
  await record(ctx.env, {
    action: "provider.import_queued",
    user,
    resourceType: "provider",
    resourceId: provider.id,
    ctx,
    details: { queued: candidates.length, provider: provider.provider_name },
  });

  return json({
    queued: candidates.length,
    message: `${candidates.length} file${candidates.length === 1 ? "" : "s"} queued for import. They will appear in your files as they finish.`,
  });
}

/** Streams a remote file through the Worker, so tokens never reach the browser. */
export async function file(ctx: Ctx): Promise<Response> {
  const user = currentUser(ctx);
  const provider = await first<ProviderRow>(ctx.env.DB, `SELECT * FROM providers WHERE id = ? AND user_id = ?`, ctx.params.id, user.id);
  if (!provider) throw notFound("That drive is not connected to your account.");

  const fileId = queryValue(ctx.url, "fileId");
  if (!fileId) throw badRequest("Pass the provider's file id as `fileId`.");

  const response = await fetchRemoteFile(ctx.env, provider, fileId);
  const headers = new Headers();
  headers.set("content-type", response.headers.get("content-type") ?? "application/octet-stream");
  headers.set("content-disposition", contentDisposition(queryValue(ctx.url, "name") ?? "download", "attachment"));
  headers.set("cache-control", "private, no-store");
  const length = response.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new Response(response.body, { status: 200, headers });
}

export { supportsBrowsing, MANAGED_PROVIDER };
