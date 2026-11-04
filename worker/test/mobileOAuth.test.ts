import { describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { loginReturnTarget, mobileFlowFromTarget, providerReturnTarget } from "../src/core/mobileOAuth";
import { sha256Base64Url } from "../src/core/crypto";
import type { Env } from "../src/env";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
const env = { APP_URL: "https://cloud.example", API_URL: "https://api.example/api" } as Env;
const nonce = "a".repeat(43);

describe("Android OAuth trust boundaries", () => {
  it("permits only configured app origins for browser login", () => {
    expect(loginReturnTarget(env, null)).toBe("https://cloud.example/dashboard");
    expect(loginReturnTarget(env, "https://cloud.example/settings")).toBe("https://cloud.example/settings");
    for (const target of ["https://evil.example", "https://cloud.example.evil.example", "javascript:alert(1)", "cloudgather://oauth?token=stolen", "https://attacker@cloud.example/"]) {
      expect(() => loginReturnTarget(env, target)).toThrow();
    }
  });
  it("accepts only exact API handoff path with high-entropy flow", () => {
    const target = `https://api.example/api/mobile/oauth/return?flow=${nonce}`;
    expect(mobileFlowFromTarget(env, target)).toBe(nonce);
    expect(loginReturnTarget(env, target)).toBe(target);
    expect(mobileFlowFromTarget(env, target.replace("api.example", "evil.example"))).toBeNull();
    expect(mobileFlowFromTarget(env, target + "#fragment")).toBeNull();
    expect(mobileFlowFromTarget(env, target.replace(nonce, "short"))).toBeNull();
  });
  it("provider app returns carry state and no arbitrary scheme or host", () => {
    expect(providerReturnTarget(env, `cloudgather://providers?state=${nonce}`)).toContain("cloudgather://providers");
    expect(providerReturnTarget(env, "https://cloud.example/providers")).toBe("https://cloud.example/providers");
    for (const value of ["cloudgather://providers", `cloudgather://oauth?state=${nonce}`, "intent://evil", `cloudgather://providers.evil?state=${nonce}`, "https://evil.example"]) {
      expect(() => providerReturnTarget(env, value)).toThrow();
    }
  });
  it("implements the RFC 7636 S256 test vector", async () => {
    expect(await sha256Base64Url("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});
