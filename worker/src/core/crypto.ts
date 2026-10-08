/**
 * Cryptographic helpers built exclusively on WebCrypto so they run unchanged on
 * the Workers runtime.
 *
 * - Passwords: PBKDF2-SHA-256, 210,000 iterations, per-user random salt.
 * - Secrets at rest (provider tokens, TOTP seeds): AES-256-GCM with ENCRYPTION_KEY.
 * - Tokens (sessions, API keys, links): 256-bit random, only SHA-256 hashes stored.
 */
import type { Env } from "../env";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PBKDF2_ITERATIONS = 100_000;

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export const randomBytes = (length = 32) => crypto.getRandomValues(new Uint8Array(length));
export const randomToken = (length = 32) => bytesToBase64Url(randomBytes(length));

/** Short, unambiguous, human-transcribable code (recovery codes, OTP fallbacks). */
export function randomCode(length = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...randomBytes(length)].map((byte) => alphabet[byte % alphabet.length]).join("");
}

export const randomDigits = (length = 6) =>
  [...randomBytes(length)].map((byte) => String(byte % 10)).join("");

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Base64Url(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const input = typeof data === "string" ? encoder.encode(data) : data;
  const digest = await crypto.subtle.digest("SHA-256", input as BufferSource);
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  return [...(await hmacSha256(secret, message))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison for secrets/signatures. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export async function passwordHash(password: string, salt: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
}

export async function verifyPassword(password: string, salt: string, expected: string): Promise<boolean> {
  return timingSafeEqual(await passwordHash(password, salt), expected);
}

/* ------------------------------------------------------------------ *
 * Envelope encryption for credentials at rest
 * ------------------------------------------------------------------ */

export class EncryptionUnavailableError extends Error {
  constructor() {
    super("ENCRYPTION_KEY is not configured on this deployment.");
  }
}

async function aesKey(env: Env): Promise<CryptoKey> {
  if (!env.ENCRYPTION_KEY) throw new EncryptionUnavailableError();
  let raw = base64UrlToBytes(env.ENCRYPTION_KEY);
  if (raw.length !== 32) {
    // Accept any passphrase by deriving a stable 32-byte key from it.
    raw = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(env.ENCRYPTION_KEY)));
  }
  return crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Returns `v1.<iv>.<ciphertext>` (base64url segments). */
export async function encryptString(env: Env, plaintext: string): Promise<string> {
  const key = await aesKey(env);
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptString(env: Env, payload: string): Promise<string> {
  const [version, ivPart, dataPart] = payload.split(".");
  if (version !== "v1" || !ivPart || !dataPart) throw new Error("Malformed encrypted payload.");
  const key = await aesKey(env);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(ivPart) as BufferSource },
    key,
    base64UrlToBytes(dataPart) as BufferSource,
  );
  return decoder.decode(plaintext);
}

export const encryptJson = async (env: Env, value: unknown) => encryptString(env, JSON.stringify(value));

export async function decryptJson<T>(env: Env, payload: string | null | undefined): Promise<T | null> {
  if (!payload) return null;
  try {
    return JSON.parse(await decryptString(env, payload)) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * TOTP (RFC 6238) for two-factor authentication
 * ------------------------------------------------------------------ */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(value: string): Uint8Array {
  const clean = value.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let buffer = 0;
  const output: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(output);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

async function totpAt(secret: string, counter: number): Promise<string> {
  const keyData = base32Decode(secret);
  const key = await crypto.subtle.importKey("raw", keyData as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const message = new ArrayBuffer(8);
  const view = new DataView(message);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, "0");
}

/** Verifies a 6-digit code, tolerating ±`window` 30-second steps of clock drift. */
export async function verifyTotp(secret: string, code: string, window = 1): Promise<boolean> {
  const normalized = String(code || "").replace(/\D/g, "");
  if (normalized.length !== 6) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (let drift = -window; drift <= window; drift += 1) {
    if (timingSafeEqual(await totpAt(secret, counter + drift), normalized)) return true;
  }
  return false;
}

export function totpUri(secret: string, account: string, issuer = "CloudGather"): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/* ------------------------------------------------------------------ *
 * AWS Signature V4 — S3-compatible provider adapters
 * ------------------------------------------------------------------ */

async function hmacRaw(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export interface SigV4Options {
  method: string;
  url: URL;
  region: string;
  service?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  payloadHash?: string;
  headers?: Record<string, string>;
}

/** Produces the `Authorization` + signing headers for an S3-compatible request. */
export async function signAwsV4(options: SigV4Options): Promise<Record<string, string>> {
  const { method, url, region, accessKeyId, secretAccessKey } = options;
  const service = options.service || "s3";
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = options.payloadHash || "UNSIGNED-PAYLOAD";

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    ...(options.sessionToken ? { "x-amz-security-token": options.sessionToken } : {}),
    ...Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), value])),
  };

  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((key) => `${key}:${String(headers[key]).trim()}\n`).join("");
  const signedHeaders = sortedKeys.join(";");
  const canonicalQuery = [...url.searchParams.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const canonicalUri = url.pathname.split("/").map((segment) => encodeURIComponent(decodeURIComponent(segment))).join("/");

  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(canonicalRequest)))),
  ].join("\n");

  let signingKey = await hmacRaw(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
  signingKey = await hmacRaw(signingKey, region);
  signingKey = await hmacRaw(signingKey, service);
  signingKey = await hmacRaw(signingKey, "aws4_request");
  const signature = toHex(await hmacRaw(signingKey, stringToSign));

  return {
    ...headers,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
