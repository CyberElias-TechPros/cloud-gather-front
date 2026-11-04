import type { Env } from "../env";
import { apiUrl, appUrl } from "../env";
import { badRequest } from "./http";

export const MOBILE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Restrict login redirects to our own app origin or the exact internal handoff. */
export function loginReturnTarget(env: Env, input: string | null): string {
  const fallback = `${appUrl(env)}/dashboard`;
  if (!input) return fallback;
  let url: URL;
  try { url = new URL(input); } catch { throw badRequest("Invalid sign-in return URL."); }
  if (mobileFlowFromTarget(env, url.toString())) return url.toString();
  if (url.origin !== new URL(appUrl(env)).origin || url.username || url.password || !["https:", "http:"].includes(url.protocol)) {
    throw badRequest("Sign-in must return to the configured application.", "invalid_redirect");
  }
  return url.toString();
}

export function mobileFlowFromTarget(env: Env, target: string): string | null {
  let url: URL;
  try { url = new URL(target); } catch { return null; }
  const expected = new URL(`${apiUrl(env)}/mobile/oauth/return`);
  const flow = url.searchParams.get("flow");
  if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password || url.hash) return null;
  return flow && MOBILE_TOKEN.test(flow) ? flow : null;
}

/** Provider return links carry no credentials. Never allow arbitrary schemes. */
export function providerReturnTarget(env: Env, input: string | null): string {
  if (!input) return `${appUrl(env)}/providers`;
  let url: URL;
  try { url = new URL(input); } catch { throw badRequest("Invalid provider return URL."); }
  if (url.protocol === "cloudgather:" && url.hostname === "providers" && !url.username && !url.password &&
      (!url.pathname || url.pathname === "/") && !url.hash && MOBILE_TOKEN.test(url.searchParams.get("state") || "")) return url.toString();
  if (url.origin === new URL(appUrl(env)).origin && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url.toString();
  throw badRequest("Provider connection must return to CloudGather.", "invalid_redirect");
}
