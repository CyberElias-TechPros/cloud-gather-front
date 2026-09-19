/**
 * Unit coverage for the pure building blocks of the Worker: crypto, validation,
 * file naming and classification, range parsing, routing, ZIP framing and the
 * presentation helpers used by the admin console.
 */

import { describe, expect, it } from "vitest";

import {
  base64url,
  base64urlDecode,
  checkPasswordStrength,
  createSignedValue,
  hashPassword,
  newId,
  randomToken,
  readSignedValue,
  seal,
  sha256Hex,
  timingSafeEqual,
  unseal,
  verifyPassword,
} from "../../src/lib/crypto";
import { asFile, buildPath, extensionOf, fileKind, kindFromName, sanitizeName } from "../../src/lib/files";
import { parseRange } from "../../src/routes/files";
import { Router } from "../../src/lib/router";
import { createZipStream, crc32Update } from "../../src/lib/zip";
import { estimateReadMinutes, slugify } from "../../src/routes/admin";
import { DEFAULT_SETTINGS, publicConfig } from "../../src/lib/settings";
import {
  optionalEnum,
  optionalInt,
  optionalString,
  queryInt,
  queryValue,
  requireEmail,
  requireString,
} from "../../src/lib/validate";
import { ApiError } from "../../src/lib/http";
import type { Env } from "../../src/types";

const env = { ENVIRONMENT: "test", APP_URL: "https://example.test" } as unknown as Env;

describe("crypto", () => {
  it("hashes and verifies passwords without storing the plaintext", async () => {
    const hash = await hashPassword("Correct-Horse-Battery-9", 10_000);
    expect(hash.hash).not.toContain("Correct-Horse");
    expect(await verifyPassword("Correct-Horse-Battery-9", hash)).toBe(true);
    expect(await verifyPassword("correct-horse-battery-9", hash)).toBe(false);
  });

  it("salts every hash independently", async () => {
    const first = await hashPassword("same-password", 10_000);
    const second = await hashPassword("same-password", 10_000);
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it("reports actionable password problems", () => {
    expect(checkPasswordStrength("password").valid).toBe(false);
    expect(checkPasswordStrength("password").problems.join(" ")).toMatch(/10 characters/);
    expect(checkPasswordStrength("Str0ng-Passw0rd!").valid).toBe(true);
  });

  it("seals and opens values, and refuses the wrong key", async () => {
    const sealed = await seal("dropbox-refresh-token", "key-a");
    expect(sealed).not.toContain("dropbox-refresh-token");
    expect(await unseal(sealed, "key-a")).toBe("dropbox-refresh-token");
    expect(await unseal(sealed, "key-b")).toBeNull();
    expect(await unseal(null, "key-a")).toBeNull();
  });

  it("signs short-lived values and rejects tampering or expiry", async () => {
    const token = await createSignedValue({ t: "shr_123" }, "secret", 60);
    expect(await readSignedValue<{ t: string }>(token, "secret")).toMatchObject({ t: "shr_123" });
    expect(await readSignedValue(token, "other-secret")).toBeNull();
    expect(await readSignedValue(`${token}x`, "secret")).toBeNull();

    const expired = await createSignedValue({ t: "shr_123" }, "secret", -1);
    expect(await readSignedValue(expired, "secret")).toBeNull();
  });

  it("compares strings in constant time and round-trips id encoding", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);

    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255]);
    expect(base64urlDecode(base64url(bytes))).toEqual(bytes);
  });

  it("generates prefixed identifiers and url-safe tokens", () => {
    const id = newId("fil");
    expect(id.startsWith("fil_")).toBe(true);
    expect(id.length).toBeGreaterThan(10);
    expect(randomToken(24)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("hashes deterministically", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});

describe("file naming", () => {
  it("strips path traversal and control characters", () => {
    expect(sanitizeName("  report.pdf  ")).toBe("report.pdf");
    expect(sanitizeName("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeName("a/b\\c.txt")).toBe("a-b-c.txt");
    expect(sanitizeName("hidden\u0000name")).toBe("hiddenname");
    expect(sanitizeName(".env")).toBe(".env");
    expect(sanitizeName("trailing...  ")).toBe("trailing");
    expect(() => sanitizeName("   ")).toThrow(ApiError);
  });

  it("caps the length while keeping the extension", () => {
    const long = `${"a".repeat(400)}.pdf`;
    const result = sanitizeName(long);
    expect(result.length).toBeLessThanOrEqual(200);
    expect(result.endsWith(".pdf")).toBe(true);
  });

  it("builds paths from the parent path", () => {
    expect(buildPath(null, "file.txt")).toBe("/file.txt");
    expect(buildPath("/", "file.txt")).toBe("/file.txt");
    expect(buildPath("/Docs", "file.txt")).toBe("/Docs/file.txt");
    expect(buildPath("/Docs/Q1/", "file.txt")).toBe("/Docs/Q1/file.txt");
  });

  it("classifies files for icons and filters", () => {
    expect(fileKind({ is_folder: 1, mime_type: null, name: "Docs" })).toBe("folder");
    expect(fileKind({ is_folder: 0, mime_type: "image/png", name: "a.png" })).toBe("image");
    expect(fileKind({ is_folder: 0, mime_type: "application/pdf", name: "a.pdf" })).toBe("pdf");
    expect(fileKind({ is_folder: 0, mime_type: null, name: "notes.md" })).toBe("document");
    expect(fileKind({ is_folder: 0, mime_type: null, name: "budget.xlsx" })).toBe("spreadsheet");
    expect(fileKind({ is_folder: 0, mime_type: null, name: "mystery.xyz" })).toBe("other");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf("noextension")).toBe("");
    expect(kindFromName("clip.mp4")).toBe("video");
  });

  it("recognises file-shaped form values", () => {
    expect(asFile(null)).toBeNull();
    expect(asFile("string")).toBeNull();
    expect(asFile({ name: "x" })).toBeNull();
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    expect(asFile(file)).toBe(file);
  });
});

describe("range parsing", () => {
  it("handles the three range forms", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ offset: 0, length: 100 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ offset: 500, length: 500 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ offset: 900, length: 100 });
  });

  it("clamps ranges that run past the end", () => {
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ offset: 900, length: 100 });
  });

  it("rejects unsatisfiable and malformed ranges", () => {
    expect(parseRange("bytes=2000-3000", 1000)).toBeNull();
    expect(parseRange("bytes=-0", 1000)).toBeNull();
    expect(parseRange("nonsense", 1000)).toBeNull();
    expect(parseRange(null, 1000)).toBeNull();
  });
});

describe("router", () => {
  const router = new Router();
  router.get("/api/files/:id/download", async () => new Response("download"));
  router.get("/api/files/tree", async () => new Response("tree"));
  router.post("/api/files/folders", async () => new Response("created"));
  router.get("/api/files/:id", async () => new Response("detail"));

  it("extracts parameters", () => {
    expect(router.match("GET", "/api/files/fil_123/download")?.params.id).toBe("fil_123");
    expect(router.match("GET", "/api/files/fil_123")?.params.id).toBe("fil_123");
  });

  it("prefers static segments over parameters", () => {
    expect(router.match("GET", "/api/files/tree")?.route?.pattern).toBe("/api/files/tree");
  });

  it("decodes encoded segments but never throws on malformed ones", () => {
    expect(router.match("GET", "/api/files/a%20b/download")?.params.id).toBe("a b");
    expect(router.match("GET", "/api/files/%E0%A4%A/download")?.params.id).toBe("%E0%A4%A");
  });

  it("separates unknown paths from wrong methods", () => {
    expect(router.match("GET", "/api/nope")).toBeNull();
    expect(router.match("DELETE", "/api/files/tree")?.methodMismatch).toBe(true);
    expect(router.match("POST", "/api/files/folders")?.methodMismatch).toBe(false);
  });

  it("runs middleware in order and stops when one short-circuits", async () => {
    const order: string[] = [];
    const scoped = new Router();
    scoped.use(async (_ctx, next) => {
      order.push("global");
      return next();
    });
    scoped.get(
      "/x",
      async (_ctx, next) => {
        order.push("guard");
        return next();
      },
      async () => {
        order.push("handler");
        return new Response("ok");
      },
    );

    const match = scoped.match("GET", "/x")!;
    await scoped.dispatch(match, { state: {} } as never);
    expect(order).toEqual(["global", "guard", "handler"]);

    const blocked = new Router();
    blocked.use(async () => new Response("stop", { status: 401 }));
    blocked.get("/y", async () => new Response("never"));
    const blockedResponse = await blocked.dispatch(blocked.match("GET", "/y")!, { state: {} } as never);
    expect(blockedResponse.status).toBe(401);
    expect(await blockedResponse.text()).toBe("stop");
  });
});

describe("streaming zip writer", () => {
  it("computes standard CRC-32 values", () => {
    const bytes = new TextEncoder().encode("The quick brown fox jumps over the lazy dog");
    expect(crc32Update(0, bytes)).toBe(0x414fa339);
  });

  it("writes local headers, data descriptors and a central directory", async () => {
    const entries = [
      { name: "a.txt", size: 3, open: async () => new Response("abc").body as ReadableStream<Uint8Array> },
      { name: "missing.txt", size: 5, open: async () => null },
      { name: "nested/b.txt", size: 2, open: async () => new Response("hi").body as ReadableStream<Uint8Array> },
    ];

    const buffer = new Uint8Array(await new Response(createZipStream(entries)).arrayBuffer());
    const view = new DataView(buffer.buffer);

    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(buffer.slice(30, 35))).toBe("a.txt");
    expect(view.getUint32(buffer.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(buffer.length - 22 + 10, true)).toBe(3);
    expect(new TextDecoder().decode(buffer)).toContain("nested/b.txt");
    expect(new TextDecoder().decode(buffer)).toContain("abc");
  });
});

describe("validation", () => {
  it("normalises and validates email addresses", () => {
    expect(requireEmail({ email: "  User@Example.COM " })).toBe("user@example.com");
    expect(() => requireEmail({ email: "not-an-email" })).toThrow(ApiError);
    expect(() => requireEmail({})).toThrow(ApiError);
  });

  it("enforces string bounds with useful messages", () => {
    expect(requireString({ name: " Reports " }, "name")).toBe("Reports");
    expect(() => requireString({ name: "" }, "name")).toThrow(/required/i);
    expect(() => requireString({ name: "x".repeat(300) }, "name", { max: 200 })).toThrow(/at most 200/i);
  });

  it("parses optional numbers and enums", () => {
    expect(optionalInt({ days: "7" }, "days", { min: 1, max: 30 })).toBe(7);
    expect(optionalInt({}, "days")).toBeUndefined();
    expect(() => optionalInt({ days: 0 }, "days", { min: 1 })).toThrow(/at least 1/i);
    expect(optionalEnum({ kind: "link" }, "kind", ["link", "email"] as const)).toBe("link");
    expect(() => optionalEnum({ kind: "nope" }, "kind", ["link", "email"] as const)).toThrow(/must be one of/i);
    expect(optionalString({ a: "  " }, "a")).toBeUndefined();
  });

  it("reads query parameters defensively", () => {
    const url = new URL("https://x.test/?limit=abc&page=3&blank=&missing");
    expect(queryInt(url, "limit", { fallback: 25 })).toBe(25);
    expect(queryInt(url, "page", { fallback: 1, min: 1, max: 10 })).toBe(3);
    expect(queryValue(url, "blank")).toBeUndefined();
    expect(queryValue(url, "missing")).toBeUndefined();
    expect(queryValue(url, "page")).toBe("3");
  });
});

describe("presentation helpers", () => {
  it("slugs titles for urls", () => {
    expect(slugify("Why your files are everywhere!")).toBe("why-your-files-are-everywhere");
    expect(slugify("  Spaced   Out  ")).toBe("spaced-out");
    expect(slugify("Ünïcode & Symbols")).toBe("unicode-symbols");
  });

  it("estimates reading time in whole minutes", () => {
    expect(estimateReadMinutes("word ".repeat(400))).toBe(2);
    expect(estimateReadMinutes("short")).toBe(1);
  });
});

describe("public configuration", () => {
  it("exposes limits without leaking secrets", () => {
    const config = publicConfig({ ...env, RESEND_API_KEY: "re_test" } as Env, DEFAULT_SETTINGS);
    expect(config.appName).toBe("CloudGather");
    expect(config.emailDeliveryConfigured).toBe(true);
    const serialised = JSON.stringify(config);
    expect(serialised).not.toContain("re_test");
    expect(serialised).not.toContain("RESEND_API_KEY");
    expect(serialised).not.toContain("session_ttl_days");
  });

  it("falls back to defaults when a setting is missing", () => {
    const config = publicConfig(env, {});
    expect(config.maxFileSizeMb).toBe(100);
    expect(config.trashRetentionDays).toBe(30);
    expect(config.registrationEnabled).toBe(true);
  });
});
