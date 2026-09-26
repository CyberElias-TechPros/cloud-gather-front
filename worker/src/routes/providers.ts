/** Cloud provider connections: OAuth, credentials, browsing, import and sync. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, first, run } from "../core/db";
import { badRequest, conflict, forbidden, json, noContent, notFound, readJson, unavailable } from "../core/http";
import { randomToken, sha256Hex } from "../core/crypto";
import { audit } from "../core/audit";
import { assertWithinCount, getEntitlements } from "../core/entitlements";
import { dispatch } from "../core/webhooks";
import { notify } from "../core/notify";
import { templates } from "../core/email";
import { fileCategory, id, inMinutes, now } from "../core/util";
import { requireFileName } from "../core/validate";
import { apiUrl, appUrl } from "../env";
import {
  ROADMAP_PROVIDERS,
  assertEncryptionConfigured,
  catalogue,
  loadProviderRow,
  markProviderError,
  openConnection,
  persistCredentials,
  publicProvider,
  refreshQuota,
  requireAdapter,
  syncIndex,
  type ProviderRow,
} from "../providers";
import { ProviderError } from "../providers/types";
import { getFolder, publicFile, uniqueName } from "./fileHelpers";

export const providerRoutes = new Router();

const callbackUri = (env: Parameters<typeof apiUrl>[0], providerId: string) => `${apiUrl(env)}/providers/oauth/${providerId}/callback`;

providerRoutes.get("/api/providers/catalogue", async (ctx) => {
  return json({
    providers: catalogue(ctx.env),
    roadmap: ROADMAP_PROVIDERS,
    encryption_ready: Boolean(ctx.env.ENCRYPTION_KEY),
  });
}, { summary: "Supported providers and their configuration state" });

providerRoutes.get("/api/providers", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all<ProviderRow>(ctx.env, "SELECT * FROM storage_providers WHERE user_id = ? ORDER BY priority, created_at", user.id);
  return json({ providers: rows.map(publicProvider) });
}, { auth: true, scope: "read", summary: "Connected provider accounts" });

/* ------------------------------------------------------------- OAuth */

providerRoutes.get("/api/providers/:provider/oauth", async (ctx) => {
  const user = requireUser(ctx);
  const adapter = requireAdapter(ctx.params.provider);
  if (adapter.kind !== "oauth") throw badRequest(`${adapter.name} connects with credentials, not OAuth.`, "not_oauth_provider");
  if (!adapter.isConfigured(ctx.env)) throw unavailable(adapter.missingConfigMessage(), "provider_not_configured");
  assertEncryptionConfigured(ctx.env);

  const entitlements = await getEntitlements(ctx.env, user);
  assertWithinCount(entitlements.usage.providerCount, entitlements.limits.maxProviders, "connected provider", entitlements.plan.name);

  const state = randomToken();
  const returnTo = ctx.url.searchParams.get("redirect") || `${appUrl(ctx.env)}/providers`;
  await run(
    ctx.env,
    "INSERT INTO oauth_states(id, state_hash, purpose, provider, user_id, redirect_uri, return_to, expires_at) VALUES(?, ?, 'connect', ?, ?, ?, ?, ?)",
    id(),
    await sha256Hex(state),
    adapter.id,
    user.id,
    callbackUri(ctx.env, adapter.id),
    returnTo,
    inMinutes(15),
  );

  return json({ url: adapter.authorizeUrl!(ctx.env, { redirectUri: callbackUri(ctx.env, adapter.id), state }) });
}, { auth: true, scope: "write", summary: "Begin connecting a provider" });

providerRoutes.get("/api/providers/oauth/:provider/callback", async (ctx) => {
  const adapter = requireAdapter(ctx.params.provider);
  const redirectWith = (params: Record<string, string>, base?: string) => {
    const target = new URL(base || `${appUrl(ctx.env)}/providers`);
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    return Response.redirect(target.toString(), 302);
  };

  const error = ctx.url.searchParams.get("error_description") || ctx.url.searchParams.get("error");
  const code = ctx.url.searchParams.get("code");
  const state = ctx.url.searchParams.get("state");
  if (error) return redirectWith({ connect: "error", message: error.slice(0, 160) });
  if (!code || !state) return redirectWith({ connect: "error", message: "The provider response was incomplete." });

  const stateRow = await first<{ id: string; user_id: string; return_to: string | null }>(
    ctx.env,
    "SELECT id, user_id, return_to FROM oauth_states WHERE state_hash = ? AND provider = ? AND purpose = 'connect' AND datetime(expires_at) > datetime('now')",
    await sha256Hex(state),
    adapter.id,
  );
  if (!stateRow?.user_id) return redirectWith({ connect: "error", message: "This connection request expired. Try again." });
  await run(ctx.env, "DELETE FROM oauth_states WHERE id = ?", stateRow.id);

  try {
    const tokens = await adapter.exchangeCode!(ctx.env, code, callbackUri(ctx.env, adapter.id));
    const account = await adapter.getAccount({
      env: ctx.env,
      id: "pending",
      providerId: adapter.id,
      tokens,
      config: {},
      rootFolderId: adapter.rootId,
    });

    const existing = await first<{ id: string }>(
      ctx.env,
      "SELECT id FROM storage_providers WHERE user_id = ? AND provider_name = ?",
      stateRow.user_id,
      adapter.id,
    );
    const rowId = existing?.id ?? id();
    if (!existing) {
      const priority = await first<{ value: number }>(
        ctx.env,
        "SELECT COALESCE(MAX(priority), 0) + 1 AS value FROM storage_providers WHERE user_id = ?",
        stateRow.user_id,
      );
      await run(
        ctx.env,
        `INSERT INTO storage_providers(id, user_id, provider_name, provider_user_email, display_name, status, priority, account_id, root_folder_id, total_space, used_space)
         VALUES(?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?)`,
        rowId,
        stateRow.user_id,
        adapter.id,
        account.email ?? null,
        account.displayName || adapter.name,
        Number(priority?.value ?? 1),
        account.accountId,
        account.rootFolderId ?? adapter.rootId,
        account.totalSpace ?? 0,
        account.usedSpace ?? 0,
      );
    } else {
      await run(
        ctx.env,
        `UPDATE storage_providers SET provider_user_email = ?, display_name = ?, status = 'connected', last_error = NULL,
                account_id = ?, root_folder_id = ?, total_space = ?, used_space = ?, updated_at = ? WHERE id = ?`,
        account.email ?? null,
        account.displayName || adapter.name,
        account.accountId,
        account.rootFolderId ?? adapter.rootId,
        account.totalSpace ?? 0,
        account.usedSpace ?? 0,
        now(),
        rowId,
      );
    }

    await persistCredentials(ctx.env, rowId, tokens, {});
    await audit(ctx, {
      action: "provider.connected",
      actorId: stateRow.user_id,
      resourceType: "provider",
      resourceId: rowId,
      details: { provider: adapter.id, account: account.email },
    });
    ctx.waitUntil(dispatch(ctx.env, stateRow.user_id, "provider.connected", { provider: adapter.id, id: rowId, email: account.email }));
    ctx.waitUntil(
      notify(ctx.env, {
        userId: stateRow.user_id,
        type: "provider.connected",
        title: `${adapter.name} connected`,
        body: account.email ? `Linked account: ${account.email}` : undefined,
        link: "/providers",
      }),
    );
    const row = await first<ProviderRow>(ctx.env, "SELECT * FROM storage_providers WHERE id = ?", rowId);
    if (row) ctx.waitUntil(syncIndex(ctx.env, row, 300).then(() => undefined, () => undefined));

    return redirectWith({ connect: "success", provider: adapter.id }, stateRow.return_to || undefined);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection failed.";
    return redirectWith({ connect: "error", message: message.slice(0, 160) }, stateRow.return_to || undefined);
  }
}, { maintenanceSafe: true });

/* ------------------------------------------------------- credentials */

providerRoutes.post("/api/providers/connect", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ provider: string; credentials: Record<string, string>; display_name?: string }>(ctx.request);
  const adapter = requireAdapter(String(payload.provider || ""));
  if (adapter.kind !== "credentials") throw badRequest(`${adapter.name} connects through OAuth. Use the Connect button instead.`, "oauth_required");
  assertEncryptionConfigured(ctx.env);

  const entitlements = await getEntitlements(ctx.env, user);
  assertWithinCount(entitlements.usage.providerCount, entitlements.limits.maxProviders, "connected provider", entitlements.plan.name);

  for (const field of adapter.credentialFields || []) {
    if (field.required && !payload.credentials?.[field.key]) throw badRequest(`${field.label} is required.`, "missing_credential");
  }

  let result: { tokens: { accessToken: string }; config: Record<string, unknown> };
  try {
    result = await adapter.connectWithCredentials!(ctx.env, payload.credentials || {});
  } catch (error) {
    if (error instanceof ProviderError) throw badRequest(error.message, "provider_rejected");
    throw error;
  }

  const account = await adapter.getAccount({
    env: ctx.env,
    id: "pending",
    providerId: adapter.id,
    tokens: result.tokens,
    config: result.config,
    rootFolderId: adapter.rootId,
  });

  const existing = await first<{ id: string }>(
    ctx.env,
    "SELECT id FROM storage_providers WHERE user_id = ? AND provider_name = ?",
    user.id,
    adapter.id,
  );
  if (existing) throw conflict(`${adapter.name} is already connected. Disconnect it first to change credentials.`, "already_connected");

  const priority = await first<{ value: number }>(
    ctx.env,
    "SELECT COALESCE(MAX(priority), 0) + 1 AS value FROM storage_providers WHERE user_id = ?",
    user.id,
  );
  const rowId = id();
  await run(
    ctx.env,
    `INSERT INTO storage_providers(id, user_id, provider_name, provider_user_email, display_name, status, priority, account_id, root_folder_id, total_space, used_space)
     VALUES(?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?, ?)`,
    rowId,
    user.id,
    adapter.id,
    account.email ?? null,
    payload.display_name?.slice(0, 80) || account.displayName || adapter.name,
    Number(priority?.value ?? 1),
    account.accountId,
    account.rootFolderId ?? adapter.rootId,
    account.totalSpace ?? 0,
    account.usedSpace ?? 0,
  );
  await persistCredentials(ctx.env, rowId, result.tokens, result.config);

  await audit(ctx, { action: "provider.connected", resourceType: "provider", resourceId: rowId, details: { provider: adapter.id } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "provider.connected", { provider: adapter.id, id: rowId }));
  const row = await first<ProviderRow>(ctx.env, "SELECT * FROM storage_providers WHERE id = ?", rowId);
  if (row) ctx.waitUntil(syncIndex(ctx.env, row, 300).then(() => undefined, () => undefined));
  return json({ provider: publicProvider(row!) }, 201);
}, { auth: true, scope: "write", verified: true, summary: "Connect a credentials-based provider" });

/* ----------------------------------------------------- manage & browse */

providerRoutes.patch("/api/providers/order", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ ids: string[] }>(ctx.request);
  if (!Array.isArray(payload.ids) || payload.ids.length > 100) throw badRequest("Provide an ordered list of provider IDs.", "invalid_order");
  await ctx.env.DB.batch(
    payload.ids.map((providerId, index) =>
      ctx.env.DB.prepare("UPDATE storage_providers SET priority = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(index + 1, now(), providerId, user.id),
    ),
  );
  return json({ ok: true });
}, { auth: true, scope: "write" });

providerRoutes.patch("/api/providers/:id", async (ctx) => {
  const user = requireUser(ctx);
  const row = await loadProviderRow(ctx.env, user.id, ctx.params.id);
  if (!row) throw notFound("Provider connection not found.", "provider_not_found");
  const payload = await readJson<{ display_name?: string; is_default?: boolean }>(ctx.request);
  if (payload.display_name !== undefined) {
    await run(ctx.env, "UPDATE storage_providers SET display_name = ?, updated_at = ? WHERE id = ?", requireFileName(payload.display_name, "Name"), now(), row.id);
  }
  if (payload.is_default !== undefined) {
    await ctx.env.DB.batch([
      ctx.env.DB.prepare("UPDATE storage_providers SET is_default = 0 WHERE user_id = ?").bind(user.id),
      ctx.env.DB.prepare("UPDATE storage_providers SET is_default = ?, updated_at = ? WHERE id = ?").bind(payload.is_default ? 1 : 0, now(), row.id),
    ]);
  }
  const updated = await loadProviderRow(ctx.env, user.id, row.id);
  return json({ provider: publicProvider(updated!) });
}, { auth: true, scope: "write" });

providerRoutes.delete("/api/providers/:id", async (ctx) => {
  const user = requireUser(ctx);
  const row = await loadProviderRow(ctx.env, user.id, ctx.params.id);
  if (!row) throw notFound("Provider connection not found.", "provider_not_found");

  await ctx.env.DB.batch([
    ctx.env.DB.prepare("DELETE FROM provider_files WHERE provider_id = ?").bind(row.id),
    ctx.env.DB.prepare("DELETE FROM files WHERE provider_id = ? AND user_id = ? AND storage_kind = 'provider'").bind(row.id, user.id),
    ctx.env.DB.prepare("DELETE FROM storage_providers WHERE id = ? AND user_id = ?").bind(row.id, user.id),
  ]);
  await audit(ctx, { action: "provider.disconnected", resourceType: "provider", resourceId: row.id, details: { provider: row.provider_name }, severity: "warning" });
  ctx.waitUntil(dispatch(ctx.env, user.id, "provider.disconnected", { provider: row.provider_name, id: row.id }));
  return noContent();
}, { auth: true, scope: "write", summary: "Disconnect a provider and forget its tokens" });

providerRoutes.post("/api/providers/:id/sync", async (ctx) => {
  const user = requireUser(ctx);
  const row = await loadProviderRow(ctx.env, user.id, ctx.params.id);
  if (!row) throw notFound("Provider connection not found.", "provider_not_found");
  try {
    await run(ctx.env, "UPDATE storage_providers SET status = 'syncing' WHERE id = ?", row.id);
    const quota = await refreshQuota(ctx.env, row);
    const indexed = await syncIndex(ctx.env, row, 800);
    await audit(ctx, { action: "provider.synced", resourceType: "provider", resourceId: row.id, details: { indexed } });
    return json({ ok: true, indexed, quota });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";
    await markProviderError(ctx.env, row.id, message);
    ctx.waitUntil(dispatch(ctx.env, user.id, "provider.error", { provider: row.provider_name, id: row.id, message }));
    throw error;
  }
}, { auth: true, scope: "write", rateLimit: { limit: 10, windowSeconds: 300, by: "user" }, summary: "Refresh quota and re-index a provider" });

providerRoutes.get("/api/providers/:id/browse", async (ctx) => {
  const user = requireUser(ctx);
  const row = await loadProviderRow(ctx.env, user.id, ctx.params.id);
  if (!row) throw notFound("Provider connection not found.", "provider_not_found");
  const adapter = requireAdapter(row.provider_name);
  const connection = await openConnection(ctx.env, row);
  const folder = ctx.url.searchParams.get("folder");
  const cursor = ctx.url.searchParams.get("cursor");
  const query = ctx.url.searchParams.get("q");

  try {
    const result = query ? await adapter.search(connection, query) : await adapter.list(connection, folder ?? row.root_folder_id ?? adapter.rootId, cursor);
    return json({
      provider: publicProvider(row),
      folder: folder ?? row.root_folder_id ?? adapter.rootId,
      entries: result.entries,
      next_cursor: result.nextCursor ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not list that folder.";
    if (error instanceof ProviderError && error.reauthorize) {
      await markProviderError(ctx.env, row.id, message);
      ctx.waitUntil(
        notify(ctx.env, {
          userId: user.id,
          type: "provider.error",
          title: `${adapter.name} needs to be reconnected`,
          body: message,
          link: "/providers",
          email: templates.providerIssue(ctx.env, adapter.name, message),
        }),
      );
    }
    throw error;
  }
}, { auth: true, scope: "read", summary: "Browse a connected provider live" });

/** Registers a remote item inside CloudGather (reference, no copy). */
providerRoutes.post("/api/providers/:id/import", async (ctx) => {
  const user = requireUser(ctx);
  const row = await loadProviderRow(ctx.env, user.id, ctx.params.id);
  if (!row) throw notFound("Provider connection not found.", "provider_not_found");
  const payload = await readJson<{
    remote_id: string; name: string; size?: number; mime_type?: string | null; is_folder?: boolean;
    web_url?: string | null; parent_folder_id?: string | null; copy?: boolean;
  }>(ctx.request);

  if (!payload.remote_id || !payload.name) throw badRequest("remote_id and name are required.", "invalid_import");
  const parentId = payload.parent_folder_id || null;
  if (parentId) await getFolder(ctx.env, user.id, parentId);
  const basePath = parentId ? (await getFolder(ctx.env, user.id, parentId)).path : "";
  const filename = await uniqueName(ctx.env, user.id, parentId, payload.name);
  const fileId = id();

  if (payload.copy && !payload.is_folder) {
    // Physically copy the remote file into CloudGather-managed storage.
    const adapter = requireAdapter(row.provider_name);
    const connection = await openConnection(ctx.env, row);
    const response = await adapter.download(connection, payload.remote_id);
    const key = `${user.id}/${fileId}/${filename.replace(/[^\w.\-() ]/g, "_")}`;
    const buffer = await response.arrayBuffer();
    const entitlements = await getEntitlements(ctx.env, user);
    if (entitlements.limits.storageBytes > 0 && entitlements.usage.storageBytes + buffer.byteLength > entitlements.limits.storageBytes) {
      throw forbidden("Importing this file would exceed your storage quota.", "quota_exceeded");
    }
    await ctx.env.FILES.put(key, buffer, { httpMetadata: { contentType: payload.mime_type || "application/octet-stream" } });
    await run(
      ctx.env,
      `INSERT INTO files(id, user_id, filename, path, size, mime_type, is_folder, parent_folder_id, storage_kind, r2_key, category, last_accessed_at)
       VALUES(?, ?, ?, ?, ?, ?, 0, ?, 'managed', ?, ?, ?)`,
      fileId,
      user.id,
      filename,
      `${basePath}/${filename}`,
      buffer.byteLength,
      payload.mime_type || null,
      parentId,
      key,
      fileCategory(payload.mime_type),
      now(),
    );
  } else {
    await run(
      ctx.env,
      `INSERT INTO files(id, user_id, filename, path, size, mime_type, is_folder, parent_folder_id, storage_kind,
                         provider_id, provider_file_id, provider_path, web_url, category)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'provider', ?, ?, ?, ?, ?)`,
      fileId,
      user.id,
      filename,
      `${basePath}/${filename}`,
      Number(payload.size || 0),
      payload.mime_type || null,
      payload.is_folder ? 1 : 0,
      parentId,
      row.id,
      payload.remote_id,
      payload.remote_id,
      payload.web_url || null,
      fileCategory(payload.mime_type, Boolean(payload.is_folder)),
    );
  }

  const file = await first(ctx.env, "SELECT * FROM files WHERE id = ?", fileId);
  await audit(ctx, { action: "provider.imported", resourceType: "file", resourceId: fileId, details: { provider: row.provider_name, copy: Boolean(payload.copy) } });
  ctx.waitUntil(dispatch(ctx.env, user.id, "file.created", { id: fileId, filename }));
  return json({ file: publicFile(file as never) }, 201);
}, { auth: true, scope: "write", verified: true, summary: "Import a provider item into CloudGather" });

/** Uploads a CloudGather-managed file into a connected provider. */
providerRoutes.post("/api/providers/:id/export", async (ctx) => {
  const user = requireUser(ctx);
  const row = await loadProviderRow(ctx.env, user.id, ctx.params.id);
  if (!row) throw notFound("Provider connection not found.", "provider_not_found");
  const payload = await readJson<{ file_id: string; remote_parent_id?: string | null }>(ctx.request);
  const file = await first<{ id: string; filename: string; size: number; mime_type: string | null; r2_key: string | null; is_folder: number }>(
    ctx.env,
    "SELECT id, filename, size, mime_type, r2_key, is_folder FROM files WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
    payload.file_id,
    user.id,
  );
  if (!file) throw notFound("File not found.", "file_not_found");
  if (file.is_folder) throw badRequest("Folders cannot be exported yet — export individual files.", "folder_export");
  if (!file.r2_key) throw badRequest("Only CloudGather-managed files can be exported to a provider.", "not_managed");

  const object = await ctx.env.FILES.get(file.r2_key);
  if (!object) throw notFound("The stored object could not be found.", "content_missing");

  const adapter = requireAdapter(row.provider_name);
  const connection = await openConnection(ctx.env, row);
  const entry = await adapter.upload(
    connection,
    payload.remote_parent_id ?? row.root_folder_id ?? adapter.rootId,
    file.filename,
    await object.arrayBuffer(),
    Number(file.size),
    file.mime_type || "application/octet-stream",
  );
  await audit(ctx, { action: "provider.exported", resourceType: "file", resourceId: file.id, details: { provider: row.provider_name } });
  return json({ entry }, 201);
}, { auth: true, scope: "write", summary: "Copy a CloudGather file to a provider" });
