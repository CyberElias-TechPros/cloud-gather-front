/**
 * Unit coverage for the pure building blocks: validation, passwords, path and
 * file rules, HTTP helpers, routing and the streaming ZIP writer.
 */

import { describe, expect, it } from "vitest";
import { v, queryObject, firstValue } from "../../src/lib/validate";
import { checkPasswordStrength, hashPassword, isCommonPassword, verifyPassword } from "../../src/lib/password";
import { buildPath, classifyKind, escapeLike, extensionOf, matchesAllowedMime, sanitizeName } from "../../src/lib/files";
import { parseRange } from "../../src/routes/files";
import { Router } from "../../src/lib/router";
import { parseCookies, serializeCookie, HttpError } from "../../src/lib/http";
import { base64ToBytes, base64url, decryptSecret, encryptSecret, randomToken, sha256Hex, signPayload, verifySignature, timingSafeEqual } from "../../src/lib/crypto";
import { createZipStream, crc32Update } from "../../src/lib/zip";
import { estimateReadMinutes, slugify } from "../../src/routes/admin";
import { publicConfig, DEFAULT_SETTINGS } from "../../src/lib/settings";

describe("validation", () => {
  it("normalises emails and rejects malformed ones", () => {
    const result = v.email().parse("  User@Example.COM ");
    expect(result.ok && result.value).toBe("user@example.com");
    expect(v.email().parse("not-an-email").ok).toBe(false);
    expect(v.email().parse("a@b").ok).toBe(false);
  });

  it("enforces bounds and reports every problem at once", () => {
    const schema = v.object({ name: v.string({ min: 3, max: 5 }), age: v.int({ min: 18 }) });
    const result = schema.parse({ name: "ab", age: 12 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors.join(" ")).toContain("name must be at least 3 characters");
      expect(result.errors.join(" ")).toContain("age must be at least 18");
    }
  });

  it("supports optional, nullable and defaulted fields", () => {
    const schema = v.object({
      kind: v.literal(["link", "email"] as const).default("link"),
      note: v.string().optional(),
      parent: v.string().nullable(),
    });
    const result = schema.parse({ parent: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.kind).toBe("link");
      expect(result.value.note).toBeUndefined();
      expect(result.value.parent).toBeNull();
    }
  });

  it("rejects unknown enum values and non-list arrays", () => {
    expect(v.literal(["a", "b"] as const).parse("c").ok).toBe(false);
    expect(v.array(v.string()).parse("nope").ok).toBe(false);
    expect(v.array(v.string(), { min: 2 }).parse(["one"]).ok).toBe(false);
  });

  it("coerces query strings without losing repeats", () => {
    const query = queryObject(new URL("https://x.test/?a=1&a=2&b=3"));
    expect(firstValue(query.a)).toBe("1");
    expect(query.b).toBe("3");
  });
});

describe("passwords", () => {
  it("hashes and verifies round-trip", async () => {
    const hash = await hashPassword("Str0ng-Passw0rd!", 1000);
    const stored = { password_hash: hash.hash, password_salt: hash.salt, password_iterations: hash.iterations };
    expect(await verifyPassword("Str0ng-Passw0rd!", stored)).toBe(true);
    expect(await verifyPassword("wrong", stored)).toBe(false);
  });

  it("uses a unique salt per hash", async () => {
    const a = await hashPassword("same-password", 1000);
    const b = await hashPassword("same-password", 1000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("reports actionable strength problems", () => {
    const weak = checkPasswordStrength("password");
    expect(weak.valid).toBe(false);
    expect(weak.problems.length).toBeGreaterThan(0);
    expect(checkPasswordStrength("Str0ng-Passw0rd!").valid).toBe(true);
    expect(isCommonPassword("password123")).toBe(true);
    expect(isCommonPassword("Str0ng-Passw0rd!")).toBe(false);
  });
});

describe("file rules", () => {
  it("sanitises names instead of trusting them", () => {
    expect(sanitizeName("  report.pdf ")).toBe("report.pdf");
    expect(sanitizeName("../../etc/passwd")).toBe("etc-passwd");
    expect(sanitizeName(".env")).toBe(".env");
    expect(sanitizeName("report...  ")).toBe("report");
    expect(sanitizeName("a/b\\c.txt")).toBe("a-b-c.txt");
    expect(sanitizeName("\u0000hidden")).toBe("hidden");
    expect(() => sanitizeName("   ")).toThrow(HttpError);
  });

  it("builds paths from a parent path", () => {
    expect(buildPath("/", "file.txt")).toBe("/file.txt");
    expect(buildPath("/Docs", "file.txt")).toBe("/Docs/file.txt");
    expect(buildPath("/Docs/Q1", "file.txt")).toBe("/Docs/Q1/file.txt");
  });

  it("escapes LIKE wildcards in user input", () => {
    expect(escapeLike("100%_done")).toBe("100\\%\\_done");
  });

  it("classifies files for icons and filters", () => {
    expect(classifyKind({ is_folder: 1, mime_type: null, name: "Docs" })).toBe("folder");
    expect(classifyKind({ is_folder: 0, mime_type: "image/png", name: "a.png" })).toBe("image");
    expect(classifyKind({ is_folder: 0, mime_type: null, name: "invoice.docx" })).toBe("document");
    expect(classifyKind({ is_folder: 0, mime_type: null, name: "sheet.csv" })).toBe("spreadsheet");
    expect(classifyKind({ is_folder: 0, mime_type: null, name: "unknown.xyz" })).toBe("other");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
    expect(extensionOf("noextension")).toBe("");
  });

  it("matches allowed MIME patterns", () => {
    expect(matchesAllowedMime("image/png", ["image/*"])).toBe(true);
    expect(matchesAllowedMime("application/pdf", ["image/*"])).toBe(false);
    expect(matchesAllowedMime("application/pdf", [])).toBe(false);
  });

  it("parses HTTP range headers safely", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=500-", 1000)).toEqual({ start: 500, end: 999 });
    expect(parseRange("bytes=-100", 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange("bytes=2000-3000", 1000)).toBeNull();
    expect(parseRange("nonsense", 1000)).toBeNull();
    expect(parseRange(null, 1000)).toBeNull();
  });
});

describe("http helpers", () => {
  it("parses and serialises cookies", () => {
    expect(parseCookies("a=1; b=hello%20world")).toEqual({ a: "1", b: "hello world" });
    const cookie = serializeCookie("cg_session", "token value", { httpOnly: true, secure: true, sameSite: "Lax", maxAge: 60 });
    expect(cookie).toContain("cg_session=token%20value");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=60");
    expect(serializeCookie("x", "y", { maxAge: 0 })).toContain("Max-Age=0");
  });
});

describe("crypto", () => {
  it("hashes deterministically and compares in constant time", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "ab")).toBe(false);
  });

  it("round-trips AES-GCM secrets and refuses a different key", async () => {
    const key = base64url(new Uint8Array(32).fill(7));
    const ciphertext = await encryptSecret("refresh-token-value", key);
    expect(ciphertext).not.toContain("refresh-token-value");
    expect(await decryptSecret(ciphertext, key)).toBe("refresh-token-value");
    const otherKey = base64url(new Uint8Array(32).fill(9));
    expect(await decryptSecret(ciphertext, otherKey)).toBeNull();
    expect(await decryptSecret(null, key)).toBeNull();
  });

  it("produces url-safe random tokens of the requested entropy", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThan(40);
    expect(randomToken(32)).not.toBe(token);
    expect(base64ToBytes(base64url(new Uint8Array([1, 2, 3])))).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("signs and verifies payloads", async () => {
    const signature = await signPayload("share:abc", "secret");
    expect(await verifySignature("share:abc", signature, "secret")).toBe(true);
    expect(await verifySignature("share:abc", signature, "other-secret")).toBe(false);
  });
});

describe("router", () => {
  const router = new Router();
  router.get("/api/files/:id/download", async (ctx) => new Response(ctx.params.id));
  router.get("/api/files/tree", async () => new Response("tree"));
  router.post("/api/files/:id", async () => new Response("patched", { status: 200 }));

  it("extracts parameters and prefers static routes", () => {
    expect(router.match("GET", "/api/files/fil_123/download")?.params.id).toBe("fil_123");
    expect(router.match("GET", "/api/files/tree")?.route.pattern).toBe("/api/files/tree");
    expect(router.match("GET", "/api/files/fil_1/download")?.route.pattern).toBe("/api/files/:id/download");
  });

  it("decodes encoded parameters and tolerates malformed ones", () => {
    expect(router.match("GET", "/api/files/a%20b/download")?.params.id).toBe("a b");
    expect(router.match("GET", "/api/files/%E0%A4%A/download")?.params.id).toBe("%E0%A4%A");
  });

  it("reports method mismatches instead of 404s", () => {
    expect(router.match("DELETE", "/api/files/tree")?.methodMismatch).toBe(true);
    expect(router.match("GET", "/api/nope")).toBeNull();
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
    const blocked = new Router();
    blocked.use(async () => new Response("stop", { status: 401 }));
    blocked.get("/x", async () => new Response("never"));

    const match = scoped.match("GET", "/x")!;
    await scoped.dispatch(match, { state: {} } as never);
    expect(order).toEqual(["global", "guard", "handler"]);
    expect(await (await blocked.dispatch(blocked.match("GET", "/x")!, { state: {} } as never)).text()).toBe("stop");
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
      { name: "empty.txt", size: 0, open: async () => new Response("").body as ReadableStream<Uint8Array> },
      { name: "nested/b.txt", size: 5, open: async () => null },
    ];
    const stream = createZipStream(entries);
    const buffer = new Uint8Array(await new Response(stream).arrayBuffer());

    const view = new DataView(buffer.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50); // local file header
    expect(new TextDecoder().decode(buffer.slice(30, 35))).toBe("a.txt");
    expect(view.getUint32(buffer.length - 22, true)).toBe(0x06054b50); // end of central directory
    expect(view.getUint16(buffer.length - 22 + 10, true)).toBe(3); // entry count
    // Content is stored verbatim (no compression).
    expect(new TextDecoder().decode(buffer)).toContain("abc");
    expect(new TextDecoder().decode(buffer)).toContain("nested/b.txt");
  });
});

describe("presentation helpers", () => {
  it("slugs titles safely", () => {
    expect(slugify("Why your files are everywhere!")).toBe("why-your-files-are-everywhere");
    expect(slugify("  Spaced   Out  ")).toBe("spaced-out");
    expect(slugify("Ünïcode & Symbols")).toBe("unicode-symbols");
  });

  it("estimates read time from word count", () => {
    expect(estimateReadMinutes("word ".repeat(400))).toBe(2);
    expect(estimateReadMinutes("short")).toBe(1);
  });

  it("never exposes secrets through the public config", () => {
    const config = publicConfig(
      { ENVIRONMENT: "production", RESEND_API_KEY: "set" } as never,
      DEFAULT_SETTINGS,
    );
    expect(config.emailDeliveryConfigured).toBe(true);
    expect(JSON.stringify(config)).not.toContain("RESEND_API_KEY");
    expect(Object.keys(config)).not.toContain("sessionTtlDays");
  });
});
