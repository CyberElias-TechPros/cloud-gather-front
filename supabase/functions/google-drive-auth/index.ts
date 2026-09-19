/**
 * google-drive-auth — OAuth 2.0 start + callback for Google Drive.
 *
 * This is the reference implementation of the provider-connect flow:
 *   POST { action: "start" }            → { url } (Google consent screen)
 *   GET  /callback?code=…&state=…       → tokens stored, redirect to /providers
 *
 * Correctness notes (fixed vs. the earlier revision):
 *  - The caller is identified from their Authorization JWT; the old code used
 *    supabase.auth.getSession() server-side, which is always unauthenticated.
 *  - The OAuth `state` parameter carries the user id + a CSRF nonce and is
 *    verified at callback time.
 *  - Tokens are stored only in the storage_providers row (server-side).
 *
 * Required secrets (Supabase dashboard → Edge Functions → secrets):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI (https://<app>/providers)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { preflight, json, errorResponse, getUserIdFromJwt, randomHex } from "../_shared/api.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const REDIRECT_URI = Deno.env.get("REDIRECT_URI") ?? "";

const SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email";

// In-memory state store with TTL. Single-region deployments are served by one
// isolate per region; for strict correctness across regions swap for a table
// or KV store (see docs/DEPLOYMENT.md → "Provider OAuth").
const stateStore = new Map<string, { userId: string; expiresAt: number }>();

function setState(state: string, userId: string): void {
  const now = Date.now();
  for (const [key, value] of stateStore) {
    if (value.expiresAt < now) stateStore.delete(key);
  }
  stateStore.set(state, { userId, expiresAt: now + 10 * 60 * 1000 });
}

function consumeState(state: string): string | null {
  const entry = stateStore.get(state);
  if (!entry || entry.expiresAt < Date.now()) return null;
  stateStore.delete(state);
  return entry.userId;
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  const configured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && REDIRECT_URI);
  const url = new URL(req.url);
  const isCallback = url.pathname.endsWith("/callback");

  try {
    // ── Start: hand back the consent URL ───────────────────────────────────
    if (req.method === "POST" && !isCallback) {
      if (!configured) {
        return json(
          {
            error: "not_configured",
            message:
              "Google Drive sign-in is not configured on this deployment. An operator must set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and REDIRECT_URI.",
          },
          501
        );
      }

      const userId = await getUserIdFromJwt(req, SUPABASE_URL, ANON_KEY);
      if (!userId) return errorResponse("Authentication required", 401);

      const state = `${userId}.${randomHex(16)}`;
      setState(state, userId);

      const authUrl =
        "https://accounts.google.com/o/oauth2/auth?" +
        new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          redirect_uri: REDIRECT_URI,
          scope: SCOPE,
          response_type: "code",
          access_type: "offline",
          prompt: "consent",
          state,
        }).toString();

      return json({ url: authUrl });
    }

    // ── Callback: exchange code, store tokens ─────────────────────────────
    if (req.method === "GET" && isCallback) {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state") ?? "";
      const providerUserId = consumeState(state);

      if (!code || !providerUserId) {
        return Response.redirect(`${new URL(REDIRECT_URI).origin}/providers?connect=error&reason=state`, 302);
      }

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        return Response.redirect(`${new URL(REDIRECT_URI).origin}/providers?connect=error&reason=token`, 302);
      }

      const tokens = (await tokenResponse.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Fetch account info for display.
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = userInfoResponse.ok
        ? ((await userInfoResponse.json()) as { email?: string })
        : {};
      const aboutResponse = await fetch(
        "https://www.googleapis.com/drive/v3/about?fields=storageQuota",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      const about = aboutResponse.ok
        ? ((await aboutResponse.json()) as { storageQuota?: { limit?: string; usage?: string } })
        : {};

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY || ANON_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
      const { data: existing } = await admin
        .from("storage_providers")
        .select("id")
        .eq("user_id", providerUserId)
        .eq("provider_name", "google-drive")
        .maybeSingle();

      const row = {
        provider_name: "google-drive",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        total_space: about.storageQuota?.limit ? Number(about.storageQuota.limit) : null,
        used_space: about.storageQuota?.usage ? Number(about.storageQuota.usage) : null,
        status: "connected",
        provider_user_email: userInfo.email ?? null,
        user_id: providerUserId,
      };

      if (existing) {
        await admin.from("storage_providers").update(row).eq("id", existing.id);
      } else {
        const { count } = await admin
          .from("storage_providers")
          .select("id", { count: "exact", head: true })
          .eq("user_id", providerUserId);
        await admin.from("storage_providers").insert({ ...row, priority: (count ?? 0) + 1 });
      }

      return Response.redirect(`${new URL(REDIRECT_URI).origin}/providers?connect=success`, 302);
    }

    return errorResponse("Method not allowed", 405);
  } catch (error) {
    console.error("[google-drive-auth]", (error as Error).message);
    return errorResponse("Provider connection failed", 500);
  }
});
