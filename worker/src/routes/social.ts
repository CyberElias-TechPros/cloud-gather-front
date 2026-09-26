/** Social sign-in (Google, GitHub, Microsoft) with account linking. */
import { Router } from "../core/router";
import type { Ctx } from "../core/context";
import { loadUserById, publicUser } from "../core/context";
import { first, run } from "../core/db";
import { badRequest, json, unavailable } from "../core/http";
import { randomToken, sha256Hex } from "../core/crypto";
import { audit } from "../core/audit";
import { sendEmail, templates } from "../core/email";
import { id, inMinutes, normalizeEmail, now } from "../core/util";
import { apiUrl, appUrl, type Env } from "../env";
import { createSession } from "./auth";

interface SocialProfile {
  subject: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  emailVerified: boolean;
}

interface SocialProvider {
  id: string;
  name: string;
  scope: string;
  clientId(env: Env): string | undefined;
  clientSecret(env: Env): string | undefined;
  authorizeUrl(env: Env, params: { clientId: string; redirectUri: string; state: string }): string;
  tokenUrl(env: Env): string;
  profile(accessToken: string): Promise<SocialProfile>;
}

const PROVIDERS: SocialProvider[] = [
  {
    id: "google",
    name: "Google",
    scope: "openid email profile",
    clientId: (env) => env.GOOGLE_CLIENT_ID,
    clientSecret: (env) => env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: (_env, { clientId, redirectUri, state }) =>
      `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent("openid email profile")}&state=${encodeURIComponent(state)}&access_type=online&prompt=select_account`,
    tokenUrl: () => "https://oauth2.googleapis.com/token",
    async profile(accessToken) {
      const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
      const data = (await response.json()) as { sub: string; email?: string; name?: string; picture?: string; email_verified?: boolean };
      return { subject: data.sub, email: data.email ?? null, name: data.name ?? null, avatar: data.picture ?? null, emailVerified: Boolean(data.email_verified) };
    },
  },
  {
    id: "github",
    name: "GitHub",
    scope: "read:user user:email",
    clientId: (env) => env.GITHUB_CLIENT_ID,
    clientSecret: (env) => env.GITHUB_CLIENT_SECRET,
    authorizeUrl: (_env, { clientId, redirectUri, state }) =>
      `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent("read:user user:email")}&state=${encodeURIComponent(state)}`,
    tokenUrl: () => "https://github.com/login/oauth/access_token",
    async profile(accessToken) {
      const headers = { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json", "user-agent": "CloudGather" };
      const user = (await (await fetch("https://api.github.com/user", { headers })).json()) as {
        id: number; login: string; name?: string; avatar_url?: string; email?: string;
      };
      let email = user.email ?? null;
      let verified = false;
      if (!email) {
        const emails = (await (await fetch("https://api.github.com/user/emails", { headers })).json()) as
          | { email: string; primary: boolean; verified: boolean }[]
          | { message?: string };
        if (Array.isArray(emails)) {
          const primary = emails.find((entry) => entry.primary) || emails[0];
          email = primary?.email ?? null;
          verified = Boolean(primary?.verified);
        }
      }
      return { subject: String(user.id), email, name: user.name || user.login, avatar: user.avatar_url ?? null, emailVerified: verified };
    },
  },
  {
    id: "microsoft",
    name: "Microsoft",
    scope: "openid email profile User.Read",
    clientId: (env) => env.MICROSOFT_CLIENT_ID,
    clientSecret: (env) => env.MICROSOFT_CLIENT_SECRET,
    authorizeUrl: (env, { clientId, redirectUri, state }) =>
      `https://login.microsoftonline.com/${env.MICROSOFT_TENANT || "common"}/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&response_mode=query&scope=${encodeURIComponent("openid email profile User.Read")}&state=${encodeURIComponent(state)}`,
    tokenUrl: (env) => `https://login.microsoftonline.com/${env.MICROSOFT_TENANT || "common"}/oauth2/v2.0/token`,
    async profile(accessToken) {
      const response = await fetch("https://graph.microsoft.com/v1.0/me", { headers: { authorization: `Bearer ${accessToken}` } });
      const data = (await response.json()) as { id: string; mail?: string; userPrincipalName?: string; displayName?: string };
      return { subject: data.id, email: data.mail || data.userPrincipalName || null, name: data.displayName ?? null, avatar: null, emailVerified: true };
    },
  },
];

const findProvider = (providerId: string) => PROVIDERS.find((provider) => provider.id === providerId);

const callbackUri = (env: Env, providerId: string) => `${apiUrl(env)}/auth/oauth/${providerId}/callback`;

export const socialRoutes = new Router();

socialRoutes.get(
  "/api/auth/oauth/:provider",
  async (ctx) => {
    const provider = findProvider(ctx.params.provider);
    if (!provider) throw badRequest(`Unknown sign-in provider "${ctx.params.provider}".`, "unknown_provider");
    const clientId = provider.clientId(ctx.env);
    if (!clientId || !provider.clientSecret(ctx.env)) {
      throw unavailable(
        `${provider.name} sign-in is not configured. Add ${provider.id.toUpperCase()}_CLIENT_ID and ${provider.id.toUpperCase()}_CLIENT_SECRET as Worker secrets.`,
        "provider_not_configured",
      );
    }

    const state = randomToken();
    const returnTo = ctx.url.searchParams.get("redirect") || `${appUrl(ctx.env)}/dashboard`;
    await run(
      ctx.env,
      "INSERT INTO oauth_states(id, state_hash, purpose, provider, user_id, redirect_uri, return_to, expires_at) VALUES(?, ?, 'login', ?, ?, ?, ?, ?)",
      id(),
      await sha256Hex(state),
      provider.id,
      ctx.user?.id ?? null,
      callbackUri(ctx.env, provider.id),
      returnTo,
      inMinutes(15),
    );

    return json({ url: provider.authorizeUrl(ctx.env, { clientId, redirectUri: callbackUri(ctx.env, provider.id), state }) });
  },
  { rateLimit: { limit: 30, windowSeconds: 900 }, summary: "Start a social sign-in" },
);

socialRoutes.get("/api/auth/oauth/:provider/callback", async (ctx) => {
  const provider = findProvider(ctx.params.provider);
  const failure = (message: string) => Response.redirect(`${appUrl(ctx.env)}/login?error=${encodeURIComponent(message)}`, 302);
  if (!provider) return failure("Unknown sign-in provider.");

  const error = ctx.url.searchParams.get("error_description") || ctx.url.searchParams.get("error");
  if (error) return failure(error.slice(0, 160));

  const code = ctx.url.searchParams.get("code");
  const state = ctx.url.searchParams.get("state");
  if (!code || !state) return failure("The sign-in response was incomplete.");

  const stateRow = await first<{ id: string; return_to: string | null; user_id: string | null }>(
    ctx.env,
    "SELECT id, return_to, user_id FROM oauth_states WHERE state_hash = ? AND provider = ? AND purpose = 'login' AND datetime(expires_at) > datetime('now')",
    await sha256Hex(state),
    provider.id,
  );
  if (!stateRow) return failure("This sign-in request expired. Please try again.");
  await run(ctx.env, "DELETE FROM oauth_states WHERE id = ?", stateRow.id);

  let profile: SocialProfile;
  try {
    const tokenResponse = await fetch(provider.tokenUrl(ctx.env), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        code,
        client_id: provider.clientId(ctx.env)!,
        client_secret: provider.clientSecret(ctx.env)!,
        redirect_uri: callbackUri(ctx.env, provider.id),
        grant_type: "authorization_code",
      }).toString(),
    });
    const tokenData = (await tokenResponse.json()) as { access_token?: string; error_description?: string };
    if (!tokenData.access_token) return failure(tokenData.error_description || "The provider did not return an access token.");
    profile = await provider.profile(tokenData.access_token);
  } catch {
    return failure("We could not complete sign-in with that provider.");
  }

  const email = normalizeEmail(profile.email);
  const identity = await first<{ user_id: string }>(
    ctx.env,
    "SELECT user_id FROM user_identities WHERE provider = ? AND subject = ?",
    provider.id,
    profile.subject,
  );

  let userId = identity?.user_id ?? stateRow.user_id ?? null;

  if (!userId && email) {
    const existing = await first<{ id: string }>(ctx.env, "SELECT id FROM users WHERE email = ? COLLATE NOCASE", email);
    userId = existing?.id ?? null;
  }

  if (!userId) {
    if (!ctx.settings.registration_enabled) return failure("New registrations are currently disabled.");
    if (!email) return failure("That provider did not share an email address, so we cannot create an account.");
    userId = id();
    await run(
      ctx.env,
      `INSERT INTO users(id, email, password_hash, password_salt, display_name, avatar_url, role, plan, status, email_verified_at)
       VALUES(?, ?, '', '', ?, ?, ?, ?, 'active', ?)`,
      userId,
      email,
      (profile.name || email.split("@")[0]).slice(0, 100),
      profile.avatar,
      normalizeEmail(ctx.env.ADMIN_EMAIL) === email ? "admin" : "user",
      ctx.settings.default_plan || "free",
      profile.emailVerified ? now() : null,
    );
    const welcome = templates.welcome(ctx.env, profile.name || email.split("@")[0]);
    ctx.waitUntil(sendEmail(ctx.env, { to: email, subject: welcome.subject, html: welcome.html, tag: "welcome", userId }).then(() => undefined));
  }

  if (!identity) {
    await run(
      ctx.env,
      "INSERT OR IGNORE INTO user_identities(id, user_id, provider, subject, email, display_name, avatar_url) VALUES(?, ?, ?, ?, ?, ?, ?)",
      id(),
      userId,
      provider.id,
      profile.subject,
      email || null,
      profile.name,
      profile.avatar,
    );
  }

  const user = await loadUserById(ctx.env, userId);
  if (!user) return failure("We could not load your account.");
  if (user.status === "suspended") return failure("This account has been suspended.");

  ctx.user = user;
  const session = await createSession(ctx, user, `oauth:${provider.id}`);
  await audit(ctx, { action: "user.login", resourceType: "user", resourceId: user.id, details: { provider: provider.id } });

  const target = new URL(stateRow.return_to || `${appUrl(ctx.env)}/dashboard`);
  target.searchParams.set("token", session.token);
  target.searchParams.set("expires_at", session.expires_at);
  return Response.redirect(target.toString(), 302);
}, { maintenanceSafe: true });

/** Exchanges a redirect token for the full session payload. */
socialRoutes.post("/api/auth/oauth/session", async (ctx: Ctx) => {
  const payload = (await ctx.request.json().catch(() => ({}))) as { token?: string };
  if (!payload.token) throw badRequest("A session token is required.", "token_required");
  const row = await first<{ user_id: string; expires_at: string }>(
    ctx.env,
    "SELECT user_id, expires_at FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND datetime(expires_at) > datetime('now')",
    await sha256Hex(payload.token),
  );
  if (!row) throw badRequest("That sign-in link is no longer valid.", "invalid_token");
  const user = await loadUserById(ctx.env, row.user_id);
  if (!user) throw badRequest("Account not found.", "user_not_found");
  return json({ token: payload.token, expires_at: row.expires_at, user: publicUser(user) });
});

export const socialProviderIds = PROVIDERS.map((provider) => provider.id);
