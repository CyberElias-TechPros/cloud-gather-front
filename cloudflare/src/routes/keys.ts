/**
 * Personal API keys for the developer API.
 *
 * Keys are shown exactly once at creation and stored as a SHA-256 hash; the
 * plaintext can never be recovered, only rotated.
 */

import { Router } from "../lib/router";
import { badRequest, clientIp, json, notFound, readJson, validationFailed } from "../lib/http";
import { v } from "../lib/validate";
import { requireAuth, rateLimit } from "../middleware";
import { recordAudit } from "../lib/events";
import { randomId, randomToken, sha256Hex } from "../lib/crypto";

const PERMISSIONS = ["read", "write", "share"] as const;

export function keyRoutes(router: Router): void {
  router.get("/api/keys", requireAuth, async (ctx) => {
    const rows = await ctx.env.DB.prepare(
      `SELECT id, name, key_prefix, permissions, last_used_at, expires_at, revoked_at, request_count, created_at
         FROM api_keys WHERE user_id = ?1 ORDER BY created_at DESC`,
    )
      .bind(ctx.user!.id)
      .all<Record<string, unknown>>();

    return json({
      keys: (rows.results ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        prefix: row.key_prefix,
        permissions: safeParse(row.permissions as string),
        lastUsedAt: row.last_used_at,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        requestCount: row.request_count,
        createdAt: row.created_at,
        status: row.revoked_at ? "revoked" : row.expires_at && new Date(row.expires_at as string) < new Date() ? "expired" : "active",
      })),
    });
  });

  router.post("/api/keys", requireAuth, rateLimit("keys-create", 20), async (ctx) => {
    const parsed = v
      .object({
        name: v.string({ min: 1, max: 60 }),
        permissions: v.array(v.literal(PERMISSIONS), { min: 1, max: 3 }).default(["read"]),
        expiresInDays: v.int({ min: 0, max: 730 }).nullable().optional(),
      })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const count = await ctx.env.DB.prepare("SELECT COUNT(*) AS total FROM api_keys WHERE user_id = ?1 AND revoked_at IS NULL")
      .bind(ctx.user!.id)
      .first<{ total: number }>();
    if ((count?.total ?? 0) >= 25) {
      throw badRequest("You have reached the limit of 25 active API keys. Revoke one to create another.");
    }

    const plaintext = `cg_live_${randomToken(32)}`;
    const keyHash = await sha256Hex(plaintext);
    const id = randomId("key");
    const now = new Date().toISOString();
    const expiresAt =
      parsed.value.expiresInDays && parsed.value.expiresInDays > 0
        ? new Date(Date.now() + parsed.value.expiresInDays * 86_400_000).toISOString()
        : null;

    await ctx.env.DB.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, permissions, expires_at, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
      .bind(id, ctx.user!.id, parsed.value.name, keyHash, plaintext.slice(0, 14), JSON.stringify(parsed.value.permissions), expiresAt, now)
      .run();

    ctx.waitUntil(recordAudit(ctx.env, {
      userId: ctx.user!.id,
      actorEmail: ctx.user!.email,
      action: "apikey.created",
      resourceType: "api_key",
      resourceId: id,
      details: { name: parsed.value.name, permissions: parsed.value.permissions },
      ip: clientIp(ctx.req),
    }));

    return json(
      {
        key: {
          id,
          name: parsed.value.name,
          prefix: plaintext.slice(0, 14),
          permissions: parsed.value.permissions,
          expiresAt,
          createdAt: now,
          status: "active",
        },
        // Shown once — never retrievable again.
        secret: plaintext,
      },
      { status: 201 },
    );
  });

  router.post("/api/keys/:id/rotate", requireAuth, rateLimit("keys-rotate", 20), async (ctx) => {
    const key = await ctx.env.DB.prepare("SELECT id, name, permissions, expires_at FROM api_keys WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL")
      .bind(ctx.params.id, ctx.user!.id)
      .first<{ id: string; name: string; permissions: string; expires_at: string | null }>();
    if (!key) throw notFound("That API key does not exist or was revoked.");

    const plaintext = `cg_live_${randomToken(32)}`;
    await ctx.env.DB.prepare("UPDATE api_keys SET key_hash = ?1, key_prefix = ?2, last_used_at = NULL WHERE id = ?3")
      .bind(await sha256Hex(plaintext), plaintext.slice(0, 14), key.id)
      .run();

    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "apikey.rotated", resourceType: "api_key", resourceId: key.id, ip: clientIp(ctx.req) }));
    return json({
      key: { id: key.id, name: key.name, prefix: plaintext.slice(0, 14), permissions: safeParse(key.permissions), expiresAt: key.expires_at, status: "active" },
      secret: plaintext,
    });
  });

  router.patch("/api/keys/:id", requireAuth, async (ctx) => {
    const parsed = v
      .object({ name: v.string({ min: 1, max: 60 }).optional(), permissions: v.array(v.literal(PERMISSIONS), { min: 1, max: 3 }).optional() })
      .parse(await readJson(ctx.req));
    if (!parsed.ok) throw validationFailed(parsed.errors);

    const key = await ctx.env.DB.prepare("SELECT id FROM api_keys WHERE id = ?1 AND user_id = ?2 AND revoked_at IS NULL")
      .bind(ctx.params.id, ctx.user!.id)
      .first<{ id: string }>();
    if (!key) throw notFound("That API key does not exist or was revoked.");

    await ctx.env.DB.prepare("UPDATE api_keys SET name = COALESCE(?1, name), permissions = COALESCE(?2, permissions) WHERE id = ?3")
      .bind(parsed.value.name ?? null, parsed.value.permissions ? JSON.stringify(parsed.value.permissions) : null, key.id)
      .run();
    return json({ ok: true });
  });

  router.delete("/api/keys/:id", requireAuth, async (ctx) => {
    const result = await ctx.env.DB.prepare("UPDATE api_keys SET revoked_at = ?1 WHERE id = ?2 AND user_id = ?3 AND revoked_at IS NULL")
      .bind(new Date().toISOString(), ctx.params.id, ctx.user!.id)
      .run();
    if (!result.meta.changes) throw notFound("That API key does not exist or was already revoked.");
    ctx.waitUntil(recordAudit(ctx.env, { userId: ctx.user!.id, actorEmail: ctx.user!.email, action: "apikey.revoked", resourceType: "api_key", resourceId: ctx.params.id, ip: clientIp(ctx.req) }));
    return json({ ok: true });
  });
}

function safeParse(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
