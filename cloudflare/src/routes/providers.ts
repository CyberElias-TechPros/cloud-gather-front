/**
 * Storage provider connections.
 *
 * Three connection models, all real:
 *  - `managed`     — the CloudGather R2 pool (always connected, zero setup)
 *  - `oauth`       — generic OAuth2 authorisation-code flow; requires operator
 *                    credentials in provider_configs, otherwise the endpoint
 *                    answers with an explicit "not configured" error
 *  - `credentials` — S3-compatible keys, probed against the live endpoint before
 *                    the connection is stored (no optimistic "connected" state)
 */

import type { Env, RouteContext } from "../types";
import { Router } from "../lib/router";
import {
  HttpError,
  badRequest,
  clientIp,
  json,
  notFound,
  readJson,
  validationFailed,
} from "../lib/http";
import { v } from "../lib/validate";
import { requireAuth, requireScope, rateLimit } from "../middleware";
import { notify, recordAudit } from "../lib/events";
import { decryptSecret, encryptSecret, randomId, randomToken, sha256Hex } from "../lib/crypto";
import { ADAPTERS, s3DownloadUrl, s3List } from "../lib/providers/adapters";
import { probeBucket, type S3Connection } from "../lib/providers/s3";
import { classifyKind } from "../lib/files";

const OAUTH_STATE_TTL_SECONDS = 600;

interface ProviderConfigRow {
  provider_name: string;
  display_name: string;
  auth_type: string;
  client_id: string | null;
  client_secret: string | null;
  scopes: string | null;
  authorize_url: string | null;
  token_url: string | null;
  is_enabled: number;
  sort_order: number;
}

interface ProviderRow {
  id: string;
  user_id: string;
  provider_name: string;
  auth_type: string;
  status: string;
  account_email: string | null;
  account_label: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scopes: string | null;
  total_space: number | null;
  used_space: number | null;
  priority: number;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
}

export function providerRoutes(router: Router): void {
  // ── Catalog + connections ────────────────────────────────────────────────
  router.get("/api/providers/catalog", requireAuth, async (ctx) => {
    const [configs, connections] = await Promise.all([
      ctx.env.DB.prepare("SELECT * FROM provider_configs ORDER BY sort_order ASC").all<ProviderConfigRow>(),
      ctx.env.DB.prepare("SELECT provider_name FROM providers WHERE user_id = ?1").bind(ctx.user!.id).all<{ provider_name: string }>(),
    ]);
    const connected = new Set((connections.results ?? []).map((row) => row.provider_name));

    return json({
      providers: (configs.results ?? []).map((config) => ({
        name: config.provider_name,
        displayName: config.display_name,
        authType: config.auth_type,
        configured: config.auth_type === "managed" ? true : config.is_enabled === 1,
        connected: connected.has(config.provider_name),
        remoteBrowsing: ADAPTERS[config.provider_name]?.supported === true,
      })),
    });
  });

  router.get("/api/providers", requireAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare(
      `SELECT p.id, p.provider_name, p.auth_type, p.status, p.account_email, p.account_label, p.token_expires_at,
              p.total_space, p.used_space, p.priority, p.last_synced_at, p.last_error, p.created_at,
              (SELECT COUNT(*) FROM files f WHERE f.provider_id = p.id AND f.trashed_at IS NULL) AS file_count,
              (SELECT COALESCE(SUM(f.size),0) FROM files f WHERE f.provider_id = p.id AND f.trashed_at IS NULL AND f.is_folder = 0) AS indexed_bytes
         FROM providers p WHERE p.user_id = ?1 ORDER BY p.priority ASC, p.created_at ASC`,
    )
      .bind(ctx.user!.id)
      .all<Record<string, unknown>>();

    return json({
      providers: (rows.results ?? []).map((row) => ({
        id: row.id,
        providerName: row.provider_name,
        authType: row.auth_type,
        status: row.status,
        accountEmail: row.account_email,
        accountLabel: row.account_label,
        tokenExpiresAt: row.token_expires_at,
        totalSpace: row.total_space,
        usedSpace: row.used_space,
        priority: row.priority,
        lastSyncedAt: row.last_synced_at,
        lastError: row.last_error,
        createdAt: row.created_at,
        fileCount: row.file_count,
        indexedBytes: row.indexed_bytes,
        remoteBrowsing: ADAPTERS[row.provider_name as string]?.supported === true,
      })),
    });
  });

  // ── OAuth connect ────────────────────────────────────────────────────────
  router.post("/api/providers/:provider/connect", requireAuth, rateLimit("provider-connect", 30), async (ctx) => {
    const provider = ctx.params.provider;
    const config = await loadConfig(ctx.env, provider);
    if (config.auth_type === "managed") throw badRequest("CloudGather Storage is always connected.");

    if (config.auth_type !== "oauth") {
      return json({
        mode: "credentials",
        provider,
        displayName: config.display_name,
        hint: credentialsHint(provider),
      });
    }

    if (config.is_enabled !== 1 || !config.client_id || !config.client_secret) {
      throw new HttpError(
        400,
        `${config.display_name} is not configured on this deployment yet. An administrator can add the OAuth client id and secret in the admin console.`,
        "provider_not_configured",
      );
    }

    const state = randomToken(24);
    const codeVerifier = randomToken(32);
    const codeChallenge = await pkceChallenge(codeVerifier);
    await ctx.env.CACHE.put(
      `oauth:${state}`,
      JSON.stringify({ provider, userId: ctx.user!.id, codeVerifier, createdAt: Date.now() }),
      { expirationTtl: OAUTH_STATE_TTL_SECONDS },
    );

    const redirectUri = `${ctx.env.API_URL}/api/providers/${provider}/callback`;
    const params = new URLSearchParams({
      client_id: config.client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scopes ?? "",
      state,
      access_type: "offline",
      prompt: "consent",
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    return json({ mode: "oauth", url: `${config.authorize_url}?${params.toString()}`, redirectUri });
  });

  router.get("/api/providers/:provider/callback", async (ctx) => {
    const provider = ctx.params.provider;
    const code = ctx.url.searchParams.get("code");
    const state = ctx.url.searchParams.get("state");
    const error = ctx.url.searchParams.get("error");

    if (error) return redirectBack(ctx, `error=${encodeURIComponent(error)}&provider=${provider}`);
    if (!code || !state) return redirectBack(ctx, `error=missing_code&provider=${provider}`);

    const stored = await ctx.env.CACHE.get<{ provider: string; userId: string; codeVerifier: string }>(`oauth:${state}`, "json");
    if (!stored || stored.provider !== provider) {
      return redirectBack(ctx, `error=state_mismatch&provider=${provider}`);
    }
    await ctx.env.CACHE.delete(`oauth:${state}`);

    const config = await loadConfig(ctx.env, provider);
    const secret = config.client_secret ? await decryptSecret(config.client_secret, tokenKey(ctx.env)) : null;
    if (!config.client_id || !secret || !config.token_url) {
      return redirectBack(ctx, `error=not_configured&provider=${provider}`);
    }

    const body = new URLSearchParams({
      code,
      client_id: config.client_id,
      client_secret: secret,
      redirect_uri: `${ctx.env.API_URL}/api/providers/${provider}/callback`,
      grant_type: "authorization_code",
      code_verifier: stored.codeVerifier,
    });

    const tokenResponse = await fetch(config.token_url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body,
    });
    if (!tokenResponse.ok) {
      console.error(JSON.stringify({ level: "warn", message: "oauth token exchange failed", provider, status: tokenResponse.status }));
      return redirectBack(ctx, `error=token_exchange_failed&provider=${provider}`);
    }

    const tokens = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      account_id?: string;
    };

    let account: { email: string | null; displayName: string | null; totalSpace: number | null; usedSpace: number | null } = {
      email: null,
      displayName: null,
      totalSpace: null,
      usedSpace: null,
    };
    const adapter = ADAPTERS[provider];
    if (adapter?.account) {
      try {
        account = await adapter.account(tokens.access_token);
      } catch (adapterError) {
        console.error(JSON.stringify({ level: "warn", message: "provider account lookup failed", provider, error: String(adapterError) }));
      }
    }

    await upsertProvider(ctx.env, {
      userId: stored.userId,
      providerName: provider,
      authType: "oauth",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
      scopes: tokens.scope ?? config.scopes,
      accountEmail: account.email,
      accountLabel: account.displayName,
      totalSpace: account.totalSpace,
      usedSpace: account.usedSpace,
    });

    await recordAudit(ctx.env, {
      userId: stored.userId,
      actorEmail: account.email,
      action: "provider.connected",
      resourceType: "provider",
      resourceId: provider,
    });
    await notify(ctx.env, stored.userId, "system", `${config.display_name} connected`, "Its files are now part of your CloudGather pool.", "/providers");

    return redirectBack(ctx, `connect=success&provider=${provider}`);
  });

  // ── Credential-based connect (S3-compatible) ─────────────────────────────
  router.post("/api/providers/:provider/credentials", requireAuth, rateLimit("provider-creds", 20), async (ctx) => {
    const provider = ctx.params.provider;
    const config = await loadConfig(ctx.env, provider);
    if (config.auth_type === "managed") throw badRequest("CloudGather Storage needs no credentials.");

    const parsed = v
      .object({
        endpoint: v.string({ min: 3, max: 200 }).optional(),
        bucket: v.string({ min: 1, max: 120 }).optional(),
        region: v.string({ min: 1, max: 60 }).optional(),
        accessKeyId: v.string({ min: 3, max: 200 }).optional(),
        secretAccessKey: v.string({ min: 3, max: 400 }).optional(),
        prefix: v.string({ max: 200 }).optional(),
        accountEmail: v.string({ max: 200 }).optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const body = parsed.value;
    if (provider !== "amazon-s3" && provider !== "backblaze") {
      throw new HttpError(
        400,
        `${config.display_name} credentials cannot be verified by this deployment. Connect it with an OAuth app instead, or ask an administrator to enable it.`,
        "provider_not_supported",
      );
    }

    const host = (body.endpoint ?? defaultEndpoint(provider)).replace(/^https?:\/\//, "").replace(/\/$/, "");
    const missing = (["bucket", "accessKeyId", "secretAccessKey"] as const).filter((key) => !body[key]);
    if (missing.length > 0) throw validationFailed(missing.map((key) => `${key} is required`));

    const connection: S3Connection = {
      endpoint: host,
      bucket: body.bucket!,
      region: body.region ?? "us-east-1",
      prefix: body.prefix ?? "",
      credentials: { accessKeyId: body.accessKeyId!, secretAccessKey: body.secretAccessKey! },
    };

    const probe = await probeBucket(connection);
    if (!probe.ok) {
      throw badRequest(`We could not verify those credentials. ${probe.error}`);
    }

    await upsertProvider(ctx.env, {
      userId: ctx.user!.id,
      providerName: provider,
      authType: "credentials",
      accessToken: JSON.stringify({
        endpoint: host,
        bucket: body.bucket,
        region: connection.region,
        prefix: connection.prefix,
        accessKeyId: body.accessKeyId,
        secretAccessKey: body.secretAccessKey,
      }),
      refreshToken: null,
      expiresAt: null,
      scopes: null,
      accountEmail: body.accountEmail ?? body.bucket ?? null,
      accountLabel: body.bucket ?? null,
      totalSpace: null,
      usedSpace: null,
    });

    await recordAudit(ctx.env, {
      userId: ctx.user!.id,
      actorEmail: ctx.user!.email,
      action: "provider.connected",
      resourceType: "provider",
      resourceId: provider,
      details: { bucket: body.bucket, endpoint: host },
      ip: clientIp(ctx.req),
    });

    return json({ ok: true, verified: true }, { status: 201 });
  });

  // ── Reorder / disconnect ─────────────────────────────────────────────────
  router.post("/api/providers/reorder", requireAuth, async (ctx) => {
    const parsed = v.object({ orderedIds: v.array(v.string({ max: 64 }), { min: 1, max: 50 }) }).parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const owned = await ctx.env.DB.prepare("SELECT id FROM providers WHERE user_id = ?1").bind(ctx.user!.id).all<{ id: string }>();
    const ownedIds = new Set((owned.results ?? []).map((row) => row.id));

    let priority = 1;
    for (const id of parsed.value.orderedIds) {
      if (!ownedIds.has(id)) continue;
      await ctx.env.DB.prepare("UPDATE providers SET priority = ?1, updated_at = ?2 WHERE id = ?3")
        .bind(priority++, new Date().toISOString(), id)
        .run();
    }
    return json({ ok: true });
  });

  router.patch("/api/providers/:id", requireAuth, async (ctx) => {
    const parsed = v
      .object({ status: v.literal(["connected", "disconnected"] as const).optional(), label: v.string({ max: 120 }).optional() })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const provider = await ctx.env.DB.prepare("SELECT * FROM providers WHERE id = ?1 AND user_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<ProviderRow>();
    if (!provider) throw notFound("That connection does not exist.");
    if (provider.auth_type === "managed" && parsed.value.status === "disconnected") {
      throw badRequest("CloudGather Storage is the primary pool and cannot be disconnected.");
    }

    await ctx.env.DB.prepare(
      "UPDATE providers SET status = COALESCE(?1, status), account_label = COALESCE(?2, account_label), updated_at = ?3 WHERE id = ?4",
    )
      .bind(parsed.value.status ?? null, parsed.value.label ?? null, new Date().toISOString(), provider.id)
      .run();
    return json({ ok: true });
  });

  router.delete("/api/providers/:id", requireAuth, async (ctx) => {
    const provider = await ctx.env.DB.prepare("SELECT * FROM providers WHERE id = ?1 AND user_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<ProviderRow>();
    if (!provider) throw notFound("That connection does not exist.");
    if (provider.auth_type === "managed" && ctx.url.searchParams.get("force") !== "true") {
      throw badRequest("CloudGather Storage is the primary pool and cannot be removed.");
    }

    const keepFiles = ctx.url.searchParams.get("keepFiles") !== "false";
    if (!keepFiles) {
      const rows = await ctx.env.DB.prepare("SELECT storage_key FROM files WHERE provider_id = ?1 AND storage_key IS NOT NULL")
        .bind(provider.id)
        .all<{ storage_key: string }>();
      const keys = (rows.results ?? []).map((row) => row.storage_key);
      for (let i = 0; i < keys.length; i += 100) await ctx.env.FILES.delete(keys.slice(i, i + 100));
      await ctx.env.DB.prepare("DELETE FROM files WHERE provider_id = ?1").bind(provider.id).run();
    } else {
      await ctx.env.DB.prepare("UPDATE files SET provider_id = NULL WHERE provider_id = ?1").bind(provider.id).run();
    }

    await ctx.env.DB.prepare("DELETE FROM providers WHERE id = ?1").bind(provider.id).run();
    await recordAudit(ctx.env, {
      userId: ctx.user!.id,
      actorEmail: ctx.user!.email,
      action: "provider.disconnected",
      resourceType: "provider",
      resourceId: provider.id,
      details: { provider: provider.provider_name, keptFiles: keepFiles },
      ip: clientIp(ctx.req),
    });
    return json({ ok: true });
  });

  // ── Remote browsing & import ─────────────────────────────────────────────
  router.get("/api/providers/:id/browse", requireAuth, requireScope("read"), async (ctx) => {
    const provider = await ctx.env.DB.prepare("SELECT * FROM providers WHERE id = ?1 AND user_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<ProviderRow>();
    if (!provider) throw notFound("That connection does not exist.");
    if (provider.status !== "connected") throw badRequest("Reconnect this provider before browsing it.");

    const folderId = ctx.url.searchParams.get("folderId");
    const prefix = ctx.url.searchParams.get("prefix");

    if (provider.provider_name === "cloudgather" || provider.auth_type === "managed") {
      // Managed pool: browse the same rows the Files page uses.
      const rows = await ctx.env.DB.prepare(
        `SELECT id, name, size, mime_type, is_folder, updated_at FROM files
          WHERE user_id = ?1 AND provider_id = ?2 AND trashed_at IS NULL
            AND COALESCE(parent_folder_id,'') = COALESCE(?3,'')
          ORDER BY is_folder DESC, lower(name) ASC LIMIT 500`,
      )
        .bind(ctx.user!.id, provider.id, folderId)
        .all<{ id: string; name: string; size: number; mime_type: string | null; is_folder: number; updated_at: string }>();
      return json({
        entries: (rows.results ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          size: row.size,
          isFolder: row.is_folder === 1,
          mimeType: row.mime_type,
          updatedAt: row.updated_at,
          kind: classifyKind({ is_folder: row.is_folder, mime_type: row.mime_type, name: row.name }),
        })),
        nextPageToken: null,
        supported: true,
      });
    }

    if (provider.auth_type === "credentials") {
      const connection = await connectionFromProvider(ctx.env, provider);
      if (!connection) throw new HttpError(409, "The stored credentials could not be read. Reconnect the provider.", "provider_credentials_invalid");
      const result = await s3List(connection, prefix ?? connection.prefix ?? "");
      return json({ ...result, supported: true, prefix: prefix ?? connection.prefix ?? "" });
    }

    const adapter = ADAPTERS[provider.provider_name];
    if (!adapter?.supported || !adapter.list) {
      return json({
        entries: [],
        nextPageToken: null,
        supported: false,
        reason: `Remote browsing for ${provider.provider_name} is not implemented in this deployment yet.`,
      });
    }

    const token = await accessTokenFor(ctx.env, provider);
    try {
      const result = await adapter.list(token, folderId);
      await ctx.env.DB.prepare("UPDATE providers SET last_synced_at = ?1 WHERE id = ?2")
        .bind(new Date().toISOString(), provider.id)
        .run();
      return json({ ...result, supported: true });
    } catch (error) {
      await ctx.env.DB.prepare("UPDATE providers SET last_error = ?1 WHERE id = ?2")
        .bind(String(error).slice(0, 300), provider.id)
        .run();
      throw new HttpError(502, `We could not list files from that provider. ${(error as Error).message}`, "provider_error");
    }
  });

  /** Indexes remote metadata locally so provider files appear in search & lists. */
  router.post("/api/providers/:id/import", requireAuth, requireScope("write"), rateLimit("provider-import", 10), async (ctx) => {
    const provider = await ctx.env.DB.prepare("SELECT * FROM providers WHERE id = ?1 AND user_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<ProviderRow>();
    if (!provider) throw notFound("That connection does not exist.");

    const parsed = v
      .object({ folderId: v.string({ max: 512 }).nullable().optional(), prefix: v.string({ max: 512 }).optional() })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    let entries: Array<{ id: string; name: string; size: number; isFolder: boolean; mimeType: string | null; updatedAt: string | null }> = [];

    if (provider.auth_type === "credentials") {
      const connection = await connectionFromProvider(ctx.env, provider);
      if (!connection) throw new HttpError(409, "The stored credentials could not be read. Reconnect the provider.", "provider_credentials_invalid");
      const result = await s3List(connection, parsed.value.prefix ?? connection.prefix ?? "");
      entries = result.entries;
    } else if (provider.auth_type === "oauth") {
      const adapter = ADAPTERS[provider.provider_name];
      if (!adapter?.list) return json({ imported: 0, supported: false });
      const token = await accessTokenFor(ctx.env, provider);
      entries = (await adapter.list(token, parsed.value.folderId ?? null)).entries;
    } else {
      throw badRequest("The managed pool is already indexed.");
    }

    const now = new Date().toISOString();
    let imported = 0;
    for (const entry of entries) {
      const existing = await ctx.env.DB.prepare(
        "SELECT id FROM files WHERE user_id = ?1 AND provider_id = ?2 AND provider_file_id = ?3",
      )
        .bind(ctx.user!.id, provider.id, entry.id)
        .first<{ id: string }>();

      if (existing) {
        await ctx.env.DB.prepare("UPDATE files SET name = ?1, size = ?2, mime_type = ?3, updated_at = ?4 WHERE id = ?5")
          .bind(entry.name, entry.size, entry.mimeType, now, existing.id)
          .run();
      } else {
        await ctx.env.DB.prepare(
          `INSERT INTO files (id, user_id, parent_folder_id, name, path, size, mime_type, is_folder, provider_id, provider_file_id, created_at, updated_at)
           VALUES (?1, ?2, NULL, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
        )
          .bind(
            randomId(entry.isFolder ? "fld" : "fil"),
            ctx.user!.id,
            entry.name,
            `/${entry.name}`,
            entry.size,
            entry.mimeType,
            entry.isFolder ? 1 : 0,
            provider.id,
            entry.id,
            now,
          )
          .run();
      }
      imported += 1;
    }

    await ctx.env.DB.prepare("UPDATE providers SET last_synced_at = ?1, last_error = NULL WHERE id = ?2").bind(now, provider.id).run();
    await recordAudit(ctx.env, {
      userId: ctx.user!.id,
      actorEmail: ctx.user!.email,
      action: "provider.imported",
      resourceType: "provider",
      resourceId: provider.id,
      details: { imported },
    });
    return json({ imported, supported: true });
  });

  /** Streams a provider-hosted file through the API (S3 → presigned redirect). */
  router.get("/api/providers/:id/file", requireAuth, requireScope("read"), async (ctx) => {
    const provider = await ctx.env.DB.prepare("SELECT * FROM providers WHERE id = ?1 AND user_id = ?2")
      .bind(ctx.params.id, ctx.user!.id)
      .first<ProviderRow>();
    if (!provider) throw notFound("That connection does not exist.");
    const fileId = ctx.url.searchParams.get("fileId");
    if (!fileId) throw badRequest("fileId is required.");

    if (provider.auth_type === "credentials") {
      const connection = await connectionFromProvider(ctx.env, provider);
      if (!connection) throw new HttpError(409, "The stored credentials could not be read.", "provider_credentials_invalid");
      const url = await s3DownloadUrl(connection, fileId);
      return Response.redirect(url, 302);
    }

    const adapter = ADAPTERS[provider.provider_name];
    if (!adapter?.download) {
      throw new HttpError(409, "Downloading from this provider is not supported yet. Use the provider's own app.", "provider_download_unsupported");
    }
    const token = await accessTokenFor(ctx.env, provider);
    const response = await adapter.download(token, fileId);
    if (!response.ok) throw new HttpError(502, "The provider refused that download. Try reconnecting the account.", "provider_error");
    const headers = new Headers();
    headers.set("content-type", response.headers.get("content-type") ?? "application/octet-stream");
    headers.set("cache-control", "private, no-store");
    headers.set("content-disposition", "attachment");
    return new Response(response.body, { status: 200, headers });
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function tokenKey(env: Env): string {
  return env.TOKEN_ENCRYPTION_KEY || env.SESSION_SECRET || "cloudgather-dev-encryption-key";
}

async function loadConfig(env: Env, provider: string): Promise<ProviderConfigRow> {
  const config = await env.DB.prepare("SELECT * FROM provider_configs WHERE provider_name = ?1").bind(provider).first<ProviderConfigRow>();
  if (!config) throw notFound(`Provider "${provider}" is not part of the catalog.`);
  return config;
}

function defaultEndpoint(provider: string): string {
  return provider === "backblaze" ? "s3.us-west-002.backblazeb2.com" : "s3.amazonaws.com";
}

function credentialsHint(provider: string): string {
  if (provider === "amazon-s3") return "Access key id, secret access key, bucket and region from your AWS IAM user.";
  if (provider === "backblaze") return "Application key id, application key, bucket name and endpoint from your Backblaze B2 account.";
  return "This provider needs an OAuth app configured by an administrator.";
}

async function pkceChallenge(verifier: string): Promise<string> {
  const { base64url } = await import("../lib/crypto");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function redirectBack(ctx: RouteContext, query: string): Response {
  return Response.redirect(`${ctx.env.APP_URL}/providers?${query}`, 302);
}

interface UpsertInput {
  userId: string;
  providerName: string;
  authType: string;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: string | null;
  scopes: string | null;
  accountEmail: string | null;
  accountLabel: string | null;
  totalSpace: number | null;
  usedSpace: number | null;
}

async function upsertProvider(env: Env, input: UpsertInput): Promise<void> {
  const now = new Date().toISOString();
  const encryptedAccess = await encryptSecret(input.accessToken, tokenKey(env));
  const encryptedRefresh = await encryptSecret(input.refreshToken, tokenKey(env));

  const existing = await env.DB.prepare("SELECT id, priority FROM providers WHERE user_id = ?1 AND provider_name = ?2")
    .bind(input.userId, input.providerName)
    .first<{ id: string; priority: number }>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE providers SET auth_type = ?1, status = 'connected', access_token = ?2, refresh_token = ?3, token_expires_at = ?4,
              scopes = ?5, account_email = ?6, account_label = ?7, total_space = ?8, used_space = ?9, updated_at = ?10
        WHERE id = ?11`,
    )
      .bind(
        input.authType,
        encryptedAccess,
        encryptedRefresh,
        input.expiresAt,
        input.scopes,
        input.accountEmail,
        input.accountLabel,
        input.totalSpace,
        input.usedSpace,
        now,
        existing.id,
      )
      .run();
    return;
  }

  const count = await env.DB.prepare("SELECT COUNT(*) AS total FROM providers WHERE user_id = ?1").bind(input.userId).first<{ total: number }>();
  await env.DB.prepare(
    `INSERT INTO providers (id, user_id, provider_name, auth_type, status, account_email, account_label, access_token, refresh_token,
                            token_expires_at, scopes, total_space, used_space, priority, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, 'connected', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14)`,
  )
    .bind(
      randomId("prv"),
      input.userId,
      input.providerName,
      input.authType,
      input.accountEmail,
      input.accountLabel,
      encryptedAccess,
      encryptedRefresh,
      input.expiresAt,
      input.scopes,
      input.totalSpace,
      input.usedSpace,
      (count?.total ?? 0) + 1,
      now,
    )
    .run();
}

async function connectionFromProvider(env: Env, provider: ProviderRow): Promise<S3Connection | null> {
  const raw = await decryptSecret(provider.access_token, tokenKey(env));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      endpoint: string;
      bucket: string;
      region: string;
      prefix?: string;
      accessKeyId: string;
      secretAccessKey: string;
    };
    return {
      endpoint: parsed.endpoint,
      bucket: parsed.bucket,
      region: parsed.region,
      prefix: parsed.prefix ?? "",
      credentials: { accessKeyId: parsed.accessKeyId, secretAccessKey: parsed.secretAccessKey },
    };
  } catch {
    return null;
  }
}

async function accessTokenFor(env: Env, provider: ProviderRow): Promise<string> {
  const token = await decryptSecret(provider.access_token, tokenKey(env));
  if (!token) throw new HttpError(409, "The stored access token could not be read. Reconnect this provider.", "provider_token_invalid");
  return token;
}

export async function refreshExpiredTokens(env: Env): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT p.*, c.token_url, c.client_id, c.client_secret
       FROM providers p JOIN provider_configs c ON c.provider_name = p.provider_name
      WHERE p.auth_type = 'oauth' AND p.status = 'connected' AND p.refresh_token IS NOT NULL
        AND p.token_expires_at IS NOT NULL AND p.token_expires_at < ?1`,
  )
    .bind(new Date(Date.now() + 5 * 60_000).toISOString())
    .all<ProviderRow & { token_url: string | null; client_id: string | null; client_secret: string | null }>();

  let refreshed = 0;
  for (const row of rows.results ?? []) {
    try {
      const refreshToken = await decryptSecret(row.refresh_token, tokenKey(env));
      const secret = row.client_secret ? await decryptSecret(row.client_secret, tokenKey(env)) : null;
      if (!refreshToken || !row.token_url || !row.client_id || !secret) continue;

      const response = await fetch(row.token_url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: row.client_id,
          client_secret: secret,
        }),
      });
      if (!response.ok) {
        await env.DB.prepare("UPDATE providers SET status = 'error', last_error = ?1 WHERE id = ?2")
          .bind(`Token refresh failed (${response.status})`, row.id)
          .run();
        continue;
      }
      const tokens = (await response.json()) as { access_token: string; expires_in?: number; refresh_token?: string };
      await env.DB.prepare(
        "UPDATE providers SET access_token = ?1, refresh_token = ?2, token_expires_at = ?3, status = 'connected', last_error = NULL WHERE id = ?4",
      )
        .bind(
          await encryptSecret(tokens.access_token, tokenKey(env)),
          tokens.refresh_token ? await encryptSecret(tokens.refresh_token, tokenKey(env)) : row.refresh_token,
          tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null,
          row.id,
        )
        .run();
      refreshed += 1;
    } catch (error) {
      console.error(JSON.stringify({ level: "warn", message: "token refresh threw", providerId: row.id, error: String(error) }));
    }
  }
  return refreshed;
}

export const __test = { pkceChallenge, connectionFromProvider, sha256Hex };
