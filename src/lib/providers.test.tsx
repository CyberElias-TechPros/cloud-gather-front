import { describe, it, expect } from "vitest";
import { PROVIDERS, PROVIDER_IDS, getProviderMeta, getProviderName, getProviderIcon } from "./providers";

describe("provider catalogue integrity", () => {
  it("has unique provider ids", () => {
    const ids = PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches the exported id list", () => {
    expect(PROVIDER_IDS).toEqual(PROVIDERS.map((p) => p.id));
  });

  it("gives every provider a name, description and icon", () => {
    for (const provider of PROVIDERS) {
      expect(provider.name.length).toBeGreaterThan(0);
      expect(provider.description.length).toBeGreaterThan(0);
      expect(typeof provider.icon).toBe("function");
      expect(provider.color).toMatch(/^text-\[#/);
    }
  });

  it("OAuth providers do not declare credential fields", () => {
    for (const provider of PROVIDERS.filter((p) => p.kind === "oauth")) {
      expect(provider.credentialFields).toBeUndefined();
    }
  });

  it("credential providers declare at least one required field", () => {
    for (const provider of PROVIDERS.filter((p) => p.kind === "credentials")) {
      expect(provider.credentialFields?.length ?? 0).toBeGreaterThan(0);
      expect(provider.credentialFields?.some((f) => f.required)).toBe(true);
      // Password-type secrets must never render as plain text inputs.
      for (const field of provider.credentialFields ?? []) {
        if (/password|secret|token|appkey|app key/i.test(field.label)) {
          expect(field.type).toBe("password");
        }
      }
    }
  });
});

describe("lookup helpers", () => {
  it("resolves by id", () => {
    expect(getProviderMeta("google-drive")?.name).toBe("Google Drive");
    expect(getProviderName("dropbox")).toBe("Dropbox");
  });

  it("falls back gracefully for unknown or empty ids", () => {
    expect(getProviderMeta("nope")).toBeUndefined();
    expect(getProviderName(null)).toBe("Unknown provider");
    expect(getProviderName("")).toBe("Unknown provider");
    expect(getProviderName("custom-thing")).toBe("custom-thing");
  });

  it("always returns an icon component", () => {
    expect(typeof getProviderIcon("google-drive")).toBe("function");
    expect(typeof getProviderIcon("mystery")).toBe("function");
  });
});
