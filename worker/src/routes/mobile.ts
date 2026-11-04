/** Native-only OAuth handoff, bound to an app-held S256 verifier and single use. */
import { Router } from "../core/router";
import { first, run } from "../core/db";
import { badRequest, json, readJson, unauthorized } from "../core/http";
import { randomToken, sha256Base64Url, sha256Hex } from "../core/crypto";
import { id, inMinutes } from "../core/util";
import { apiUrl } from "../env";
import type { Ctx } from "../core/context";
import { loadUserById } from "../core/context";
import { MOBILE_TOKEN } from "../core/mobileOAuth";
import { createSession } from "./auth";
import { audit } from "../core/audit";

export const mobileRoutes = new Router();

mobileRoutes.post("/api/mobile/oauth/start", async (ctx) => {
  const body = await readJson<{ challenge?: string; state?: string }>(ctx.request);
  if (!MOBILE_TOKEN.test(body.challenge || "") || !MOBILE_TOKEN.test(body.state || "")) {
    throw badRequest("An S256 challenge and a random client state are required.");
  }
  const flow = randomToken();
  await run(ctx.env, "DELETE FROM mobile_oauth_flows WHERE datetime(expires_at) <= datetime('now')");
  await run(ctx.env,
    "INSERT INTO mobile_oauth_flows(id_hash, challenge, client_state, expires_at) VALUES(?, ?, ?, ?)",
    await sha256Hex(flow), body.challenge, body.state, inMinutes(10));
  return json({ redirect: `${apiUrl(ctx.env)}/mobile/oauth/return?flow=${flow}` });
}, { rateLimit: { limit: 20, windowSeconds: 900 }, summary: "Start a verifier-bound Android sign-in" });

/** Called inside the validated social callback, before any session is minted. */
export async function finishMobileOAuth(ctx: Ctx, flow: string, userId: string): Promise<Response> {
  const code = randomToken();
  const row = await first<{ client_state: string }>(ctx.env,
    `UPDATE mobile_oauth_flows SET user_id = ?, code_hash = ?, expires_at = ?
     WHERE id_hash = ? AND user_id IS NULL AND datetime(expires_at) > datetime('now') RETURNING client_state`,
    userId, await sha256Hex(code), inMinutes(2), await sha256Hex(flow));
  if (!row) throw badRequest("This Android sign-in expired. Start again.", "mobile_flow_expired");
  return Response.redirect(`cloudgather://oauth?code=${code}&state=${encodeURIComponent(row.client_state)}`, 302);
}

mobileRoutes.post("/api/mobile/oauth/exchange", async (ctx) => {
  const body = await readJson<{ code?: string; verifier?: string }>(ctx.request);
  if (!MOBILE_TOKEN.test(body.code || "") || !MOBILE_TOKEN.test(body.verifier || "")) throw badRequest("Invalid authorization code or verifier.");
  // DELETE RETURNING is atomic: concurrent exchanges cannot both redeem a code.
  // A wrong verifier does not consume someone else's pending authorization.
  const row = await first<{ user_id: string }>(ctx.env,
    `DELETE FROM mobile_oauth_flows WHERE code_hash = ? AND challenge = ?
     AND user_id IS NOT NULL AND datetime(expires_at) > datetime('now') RETURNING user_id`,
    await sha256Hex(body.code!), await sha256Base64Url(body.verifier!));
  if (!row) throw unauthorized("This Android sign-in expired or was already used.", "mobile_code_invalid");
  const user = await loadUserById(ctx.env, row.user_id);
  if (!user || user.status === "suspended") throw unauthorized("This account is not available.");
  ctx.user = user;
  if (user.totp_enabled) {
    const challenge = randomToken();
    await run(ctx.env, "INSERT INTO mfa_challenges(id, user_id, token_hash, expires_at) VALUES(?, ?, ?, ?)",
      id(), user.id, await sha256Hex(challenge), inMinutes(10));
    return json({ mfa_required: true, challenge, methods: ["totp", "recovery_code"] });
  }
  await audit(ctx, { action: "user.login", resourceType: "user", resourceId: user.id, details: { client: "android" } });
  return json(await createSession(ctx, user, "android"));
}, { rateLimit: { limit: 20, windowSeconds: 900 }, summary: "Redeem a single-use Android authorization code" });
