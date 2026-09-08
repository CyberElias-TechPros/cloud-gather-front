/**
 * api-key-management — create / list / revoke personal API keys.
 *
 * Security model:
 *  - The caller is identified by their Supabase JWT (Authorization header),
 *    NOT by a server-side `getSession()` (which is always unauthenticated).
 *  - Keys are generated as `cg_<96-bit-hex>`, stored as SHA-256 hashes with a
 *    short display prefix. The plaintext value is returned exactly once.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  preflight,
  json,
  errorResponse,
  getUserIdFromJwt,
  sha256Hex,
  randomHex,
  normalizePermissions,
} from "../_shared/api.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED_PERMISSIONS = new Set(["read", "write", "share"]);

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  permissions: unknown;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  const userId = await getUserIdFromJwt(req, SUPABASE_URL, ANON_KEY);
  if (!userId) {
    return errorResponse("Authentication required", 401);
  }

  // The service-role client performs writes scoped explicitly to the caller's
  // user id; RLS alone cannot authorize non-JWT API access patterns.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const url = new URL(req.url);
  const path = url.pathname.split("/").filter(Boolean).pop() ?? "";

  try {
    // ── List keys ──────────────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data, error } = await admin
        .from("api_keys")
        .select("id, name, key_prefix, permissions, created_at, last_used_at, expires_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const keys = (data as ApiKeyRow[]).map((key) => ({
        ...key,
        permissions: normalizePermissions(key.permissions),
      }));
      return json({ keys });
    }

    // ── Create key ─────────────────────────────────────────────────────────
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const name = typeof body.name === "string" ? body.name.trim() : "";
      const permissions = normalizePermissions(body.permissions);
      const expiresAt = typeof body.expiresAt === "string" && body.expiresAt ? body.expiresAt : null;

      if (!name) return errorResponse("API key name is required", 400);
      if (name.length > 100) return errorResponse("API key name is too long (max 100 characters)", 400);
      if (permissions.length === 0) return errorResponse("At least one permission is required", 400);
      const invalid = permissions.filter((p) => !ALLOWED_PERMISSIONS.has(p));
      if (invalid.length > 0) return errorResponse(`Unknown permission(s): ${invalid.join(", ")}`, 400);
      if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
        return errorResponse("expiresAt must be a valid date", 400);
      }

      const plaintext = `cg_${randomHex(48)}`;
      const keyHash = await sha256Hex(plaintext);
      const keyPrefix = plaintext.slice(0, 8);

      const { data, error } = await admin
        .from("api_keys")
        .insert({
          name,
          key_hash: keyHash,
          key_prefix: keyPrefix,
          user_id: userId,
          permissions: JSON.stringify(permissions),
          expires_at: expiresAt,
        })
        .select("id, name, key_prefix, permissions, created_at, expires_at")
        .single();

      if (error) throw new Error(error.message);

      return json({ apiKey: { ...data, key: plaintext } }, 201);
    }

    // ── Revoke key ─────────────────────────────────────────────────────────
    if (req.method === "DELETE") {
      const keyId = path;
      if (!keyId) return errorResponse("Key id is required", 400);

      const { error, count } = await admin
        .from("api_keys")
        .delete({ count: "exact" })
        .eq("id", keyId)
        .eq("user_id", userId);

      if (error) throw new Error(error.message);
      if (!count) return errorResponse("Key not found", 404);
      return json({ success: true });
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("[api-key-management]", (error as Error).message);
    return errorResponse("The request could not be completed. Please try again.", 500);
  }
});
