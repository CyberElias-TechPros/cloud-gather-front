/** Personal API keys: scoped, expiring, revocable, observable. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, first, run } from "../core/db";
import { badRequest, conflict, json, noContent, notFound, readJson } from "../core/http";
import { randomToken, sha256Hex } from "../core/crypto";
import { audit } from "../core/audit";
import { assertWithinCount, getEntitlements } from "../core/entitlements";
import { id, now, parseJson } from "../core/util";
import { optionalIsoDate, optionalString, requireArray, requireString } from "../core/validate";

export const API_SCOPES = ["read", "write", "share", "admin"] as const;

export const apiKeyRoutes = new Router();

const publicKey = (row: Record<string, unknown>) => ({
  id: row.id,
  name: row.name,
  description: row.description,
  key_prefix: row.key_prefix,
  permissions: parseJson<string[]>(row.permissions as string, ["read"]),
  last_used_at: row.last_used_at,
  last_used_ip: row.last_used_ip,
  use_count: Number(row.use_count || 0),
  expires_at: row.expires_at,
  revoked_at: row.revoked_at,
  created_at: row.created_at,
});

apiKeyRoutes.get("/api/api-keys", async (ctx) => {
  const user = requireUser(ctx);
  const rows = await all(ctx.env, "SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC", user.id);
  const entitlements = await getEntitlements(ctx.env, user);
  return json({
    keys: rows.map(publicKey),
    scopes: API_SCOPES,
    limits: { max_keys: entitlements.limits.maxApiKeys, rate_limit_per_minute: entitlements.limits.apiRateLimitPerMinute },
  });
}, { auth: true, summary: "List API keys" });

apiKeyRoutes.post("/api/api-keys", async (ctx) => {
  const user = requireUser(ctx);
  const payload = await readJson<{ name: string; description?: string; permissions?: string[]; expires_at?: string | null }>(ctx.request);
  const entitlements = await getEntitlements(ctx.env, user);
  assertWithinCount(entitlements.usage.apiKeyCount, entitlements.limits.maxApiKeys, "API key", entitlements.plan.name);

  const name = requireString(payload.name, "Key name", { max: 80 });
  const requested = payload.permissions ? requireArray<string>(payload.permissions, "permissions", 8) : ["read"];
  const permissions = requested.filter((scope) => (API_SCOPES as readonly string[]).includes(scope));
  if (!permissions.length) throw badRequest(`Choose at least one scope: ${API_SCOPES.join(", ")}.`, "invalid_scope");
  if (permissions.includes("admin") && user.role !== "admin") throw badRequest("Only administrators can mint admin-scoped keys.", "invalid_scope");

  const token = `cg_${ctx.env.ENVIRONMENT === "preview" ? "test_" : "live_"}${randomToken(24)}`;
  const keyId = id();
  await run(
    ctx.env,
    `INSERT INTO api_keys(id, user_id, name, description, key_hash, key_prefix, permissions, expires_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    keyId,
    user.id,
    name,
    optionalString(payload.description, "Description", 200),
    await sha256Hex(token),
    token.slice(0, 16),
    JSON.stringify(permissions),
    optionalIsoDate(payload.expires_at, "Expiry date"),
  );

  await audit(ctx, { action: "api_key.created", resourceType: "api_key", resourceId: keyId, details: { name, permissions } });
  const row = await first(ctx.env, "SELECT * FROM api_keys WHERE id = ?", keyId);
  return json(
    { key: { ...publicKey(row as Record<string, unknown>), key: token }, warning: "Copy this key now — it is never shown again." },
    201,
  );
}, { auth: true, verified: true, summary: "Create an API key" });

apiKeyRoutes.patch("/api/api-keys/:id", async (ctx) => {
  const user = requireUser(ctx);
  const row = await first<{ id: string }>(ctx.env, "SELECT id FROM api_keys WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!row) throw notFound("API key not found.", "key_not_found");
  const payload = await readJson<{ name?: string; description?: string | null; permissions?: string[]; expires_at?: string | null }>(ctx.request);
  const updates: string[] = [];
  const args: unknown[] = [];
  if (payload.name !== undefined) {
    updates.push("name = ?");
    args.push(requireString(payload.name, "Key name", { max: 80 }));
  }
  if (payload.description !== undefined) {
    updates.push("description = ?");
    args.push(optionalString(payload.description, "Description", 200));
  }
  if (payload.permissions !== undefined) {
    const permissions = requireArray<string>(payload.permissions, "permissions", 8).filter((scope) => (API_SCOPES as readonly string[]).includes(scope));
    if (!permissions.length) throw badRequest("Choose at least one scope.", "invalid_scope");
    updates.push("permissions = ?");
    args.push(JSON.stringify(permissions));
  }
  if (payload.expires_at !== undefined) {
    updates.push("expires_at = ?");
    args.push(optionalIsoDate(payload.expires_at, "Expiry date"));
  }
  if (!updates.length) throw badRequest("Nothing to update.", "no_changes");
  await run(ctx.env, `UPDATE api_keys SET ${updates.join(", ")} WHERE id = ?`, ...args, row.id);
  await audit(ctx, { action: "api_key.updated", resourceType: "api_key", resourceId: row.id });
  return json({ key: publicKey((await first(ctx.env, "SELECT * FROM api_keys WHERE id = ?", row.id)) as Record<string, unknown>) });
}, { auth: true });

apiKeyRoutes.post("/api/api-keys/:id/rotate", async (ctx) => {
  const user = requireUser(ctx);
  const row = await first<{ id: string; revoked_at: string | null }>(
    ctx.env,
    "SELECT id, revoked_at FROM api_keys WHERE id = ? AND user_id = ?",
    ctx.params.id,
    user.id,
  );
  if (!row) throw notFound("API key not found.", "key_not_found");
  if (row.revoked_at) throw conflict("This key has been revoked. Create a new one instead.", "key_revoked");
  const token = `cg_${ctx.env.ENVIRONMENT === "preview" ? "test_" : "live_"}${randomToken(24)}`;
  await run(
    ctx.env,
    "UPDATE api_keys SET key_hash = ?, key_prefix = ?, use_count = 0, last_used_at = NULL WHERE id = ?",
    await sha256Hex(token),
    token.slice(0, 16),
    row.id,
  );
  await audit(ctx, { action: "api_key.rotated", resourceType: "api_key", resourceId: row.id, severity: "warning" });
  return json({ key: { ...publicKey((await first(ctx.env, "SELECT * FROM api_keys WHERE id = ?", row.id)) as Record<string, unknown>), key: token } });
}, { auth: true });

apiKeyRoutes.delete("/api/api-keys/:id", async (ctx) => {
  const user = requireUser(ctx);
  const result = await run(ctx.env, "DELETE FROM api_keys WHERE id = ? AND user_id = ?", ctx.params.id, user.id);
  if (!result.meta.changes) throw notFound("API key not found.", "key_not_found");
  await audit(ctx, { action: "api_key.revoked", resourceType: "api_key", resourceId: ctx.params.id, severity: "warning" });
  return noContent();
}, { auth: true });
