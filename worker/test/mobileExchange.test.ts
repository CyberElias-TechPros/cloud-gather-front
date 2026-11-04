import { beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { Ctx } from "../src/core/context";
import type { Env } from "../src/env";

const state = vi.hoisted(() => ({
  flows: new Map<string, { challenge: string; client_state: string; user_id: string | null; code_hash: string | null; expires_at: string }>(),
  user: { id: "owner", status: "active", totp_enabled: false },
  session: vi.fn(async () => ({ token: "new-private-session", user: { id: "owner" } })),
  mfa: [] as unknown[][],
}));
vi.mock("../src/core/db", () => ({
  run: vi.fn(async (_env, sql: string, ...args: unknown[]) => {
    if (sql.startsWith("INSERT INTO mobile_oauth_flows")) state.flows.set(String(args[0]), {
      challenge: String(args[1]), client_state: String(args[2]), expires_at: String(args[3]), user_id: null, code_hash: null,
    });
    if (sql.startsWith("INSERT INTO mfa_challenges")) state.mfa.push(args);
  }),
  first: vi.fn(async (_env, sql: string, ...args: unknown[]) => {
    if (sql.startsWith("UPDATE mobile_oauth_flows")) {
      const flow = state.flows.get(String(args[3]));
      if (!flow || flow.user_id || Date.parse(flow.expires_at) <= Date.now()) return null;
      Object.assign(flow, { user_id: args[0], code_hash: args[1], expires_at: args[2] });
      return { client_state: flow.client_state };
    }
    if (sql.startsWith("DELETE FROM mobile_oauth_flows")) {
      for (const [key, flow] of state.flows) {
        if (flow.code_hash === args[0] && flow.challenge === args[1] && flow.user_id && Date.parse(flow.expires_at) > Date.now()) {
          state.flows.delete(key); return { user_id: flow.user_id };
        }
      }
    }
    return null;
  }),
}));
vi.mock("../src/core/context", () => ({ loadUserById: vi.fn(async () => state.user) }));
vi.mock("../src/routes/auth", () => ({ createSession: state.session }));
vi.mock("../src/core/audit", () => ({ audit: vi.fn(async () => {}) }));
import { mobileRoutes, finishMobileOAuth } from "../src/routes/mobile";
import { sha256Base64Url, sha256Hex } from "../src/core/crypto";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const verifier = "v".repeat(43);
const clientState = "s".repeat(43);
const env = { API_URL: "https://api.example/api" } as Env;
function ctx(body: object): Ctx {
  return { env, request: new Request("https://api.example/api/mobile/oauth/exchange", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }), user: null, waitUntil: () => {} } as unknown as Ctx;
}
async function begin() {
  const start = mobileRoutes.match("POST", "/api/mobile/oauth/start")!.route.handler;
  const response = await start(ctx({ challenge: await sha256Base64Url(verifier), state: clientState }));
  const { redirect } = await response.json() as { redirect: string };
  const flow = new URL(redirect).searchParams.get("flow")!;
  const completed = await finishMobileOAuth(ctx({}), flow, "owner");
  const callback = new URL(completed.headers.get("location")!);
  return { flow, callback, code: callback.searchParams.get("code")! };
}
const exchange = (code: string, value = verifier) => mobileRoutes.match("POST", "/api/mobile/oauth/exchange")!.route.handler(ctx({ code, verifier: value }));
beforeEach(() => { state.flows.clear(); state.session.mockClear(); state.mfa = []; state.user = { id: "owner", status: "active", totp_enabled: false }; });
describe("single-use mobile exchange", () => {
  it("never puts bearer tokens in deep links or storage", async () => {
    const { callback, flow } = await begin();
    expect(callback.protocol).toBe("cloudgather:");
    expect(callback.searchParams.get("state")).toBe(clientState);
    expect(callback.searchParams.has("token")).toBe(false);
    expect(state.flows.has(flow)).toBe(false); // flow identifier is hashed too
    expect(state.flows.has(await sha256Hex(flow))).toBe(true);
    expect(state.session).not.toHaveBeenCalled();
  });
  it("wrong verifier cannot redeem or consume the code", async () => {
    const { code } = await begin();
    await expect(exchange(code, "x".repeat(43))).rejects.toThrow();
    expect((await exchange(code)).status).toBe(200);
    expect(state.session).toHaveBeenCalledOnce();
    await expect(exchange(code)).rejects.toThrow();
  });
  it("concurrent redemptions create exactly one session", async () => {
    const { code } = await begin();
    const results = await Promise.allSettled([exchange(code), exchange(code)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(state.session).toHaveBeenCalledOnce();
  });
  it("expired codes cannot be exchanged", async () => {
    const { code } = await begin();
    state.flows.forEach(row => { row.expires_at = "2000-01-01T00:00:00Z"; });
    await expect(exchange(code)).rejects.toThrow();
    expect(state.session).not.toHaveBeenCalled();
  });
  it("enforces MFA before minting an Android session", async () => {
    const { code } = await begin(); state.user.totp_enabled = true;
    const body = await (await exchange(code)).json() as { mfa_required: boolean; challenge: string };
    expect(body.mfa_required).toBe(true); expect(body.challenge).toHaveLength(43);
    expect(state.session).not.toHaveBeenCalled(); expect(state.mfa).toHaveLength(1);
  });
  it("rejects suspended accounts at exchange time", async () => {
    const { code } = await begin(); state.user.status = "suspended";
    await expect(exchange(code)).rejects.toThrow(); expect(state.session).not.toHaveBeenCalled();
  });
  it("rejects malformed requests", async () => {
    await expect(mobileRoutes.match("POST", "/api/mobile/oauth/start")!.route.handler(ctx({ challenge: "short", state: "short" }))).rejects.toThrow();
    expect(state.flows.size).toBe(0);
  });
});
