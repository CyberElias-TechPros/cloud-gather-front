/**
 * Cryptography for the Worker — all built on WebCrypto, no Node built-ins.
 *
 *  * Passwords: PBKDF2-HMAC-SHA256 with a per-user 16-byte salt.
 *  * Session / API tokens: 32 bytes of CSPRNG output, stored as SHA-256 hashes.
 *  * Provider credentials: AES-256-GCM, so a database dump alone is useless.
 *  * OAuth state and share passwords: HMAC-SHA256 signatures.
 */

import { ApiError } from "./http";

export const DEFAULT_ITERATIONS = 210_000;
const encoder = new TextEncoder();

const BASE64URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function base64url(bytes: Uint8Array): string {
  let output = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    output += BASE64URL_ALPHABET[a >> 2];
    output += BASE64URL_ALPHABET[((a & 0x03) << 4) | ((b ?? 0) >> 4)];
    if (b === undefined) break;
    output += BASE64URL_ALPHABET[((b & 0x0f) << 2) | ((c ?? 0) >> 6)];
    if (c === undefined) break;
    output += BASE64URL_ALPHABET[c & 0x3f];
  }
  return output;
}

export function base64urlDecode(value: string): Uint8Array {
  const clean = value.replace(/=+$/, "");
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    const index = BASE64URL_ALPHABET.indexOf(char);
    if (index === -1) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** Random URL-safe token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return base64url(buffer);
}

/** Prefixed identifier: `usr_9f2c…`. */
export function newId(prefix: string): string {
  return `${prefix}_${randomToken(16)}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return bytesToHex(new Uint8Array(digest));
}

export async function sha256Base64(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return base64url(new Uint8Array(digest));
}

/** Constant-time string comparison. Length differences are folded into the timing. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Passwords
// ---------------------------------------------------------------------------

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
  algorithm: "pbkdf2-sha256";
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as unknown as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<PasswordHash> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await derive(password, salt, iterations);
  return { hash: base64url(derived), salt: base64url(salt), iterations, algorithm: "pbkdf2-sha256" };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const derived = await derive(password, base64urlDecode(stored.salt), stored.iterations);
  return timingSafeEqual(base64url(derived), stored.hash);
}

/** Burned when an account does not exist, so failed logins take the same time. */
export const DUMMY_PASSWORD_HASH: PasswordHash = {
  hash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  salt: "AAAAAAAAAAAAAAAAAAAAAA",
  iterations: DEFAULT_ITERATIONS,
  algorithm: "pbkdf2-sha256",
};

export interface PasswordStrength {
  valid: boolean;
  problems: string[];
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789", "qwerty", "qwerty123",
  "letmein", "welcome", "admin", "admin123", "iloveyou", "monkey", "dragon", "abc123", "111111",
  "cloudgather", "cloudunity", "changeme", "secret", "football", "baseball", "sunshine",
]);

export function checkPasswordStrength(password: string): PasswordStrength {
  const problems: string[] = [];
  if (password.length < 10) problems.push("Use at least 10 characters");
  if (!/[a-z]/.test(password)) problems.push("Add a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("Add an uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("Add a number");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("Add a symbol");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) problems.push("That password is too common");
  if (/^(.)\1+$/.test(password)) problems.push("That password repeats one character");
  if (password.length > 200) problems.push("Passwords are limited to 200 characters");
  return { valid: problems.length === 0, problems };
}

// ---------------------------------------------------------------------------
// Sealed values (provider tokens, OAuth client secrets)
// ---------------------------------------------------------------------------

async function encryptionKey(secret: string): Promise<CryptoKey> {
  const material = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/**
 * Seals a value with AES-256-GCM. The envelope records the version so the key
 * can be rotated later without losing data.
 */
export async function seal(plaintext: string, secret: string): Promise<string> {
  if (!secret) throw new ApiError("internal_error", "Encryption key is not configured.");
  const key = await encryptionKey(secret);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext),
  );
  return `v1.${base64url(iv)}.${base64url(new Uint8Array(ciphertext))}`;
}

/** Opens a sealed value. Returns null when the payload is unreadable. */
export async function unseal(sealed: string | null | undefined, secret: string): Promise<string | null> {
  if (!sealed || !secret) return null;
  const [version, ivPart, dataPart] = sealed.split(".");
  if (version !== "v1" || !ivPart || !dataPart) return null;
  try {
    const key = await encryptionKey(secret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64urlDecode(ivPart) as unknown as BufferSource },
      key,
      base64urlDecode(dataPart) as unknown as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Signatures (OAuth state, share unlock cookies)
// ---------------------------------------------------------------------------

export async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return base64url(new Uint8Array(signature));
}

export async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  const expected = await signPayload(payload, secret);
  return timingSafeEqual(expected, signature);
}

/** `payload.signature` with an expiry baked into the payload. */
export async function createSignedValue(data: Record<string, unknown>, secret: string, ttlSeconds: number): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ ...data, exp: Math.floor(Date.now() / 1000) + ttlSeconds })));
  const signature = await signPayload(payload, secret);
  return `${payload}.${signature}`;
}

export async function readSignedValue<T = Record<string, unknown>>(value: string, secret: string): Promise<T | null> {
  const index = value.lastIndexOf(".");
  if (index === -1) return null;
  const payload = value.slice(0, index);
  const signature = value.slice(index + 1);
  if (!(await verifySignature(payload, signature, secret))) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64urlDecode(payload))) as { exp?: number };
    if (typeof decoded.exp === "number" && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded as T;
  } catch {
    return null;
  }
}

/** Deterministic cache key that never contains the raw secret. */
export async function hashedKey(prefix: string, value: string): Promise<string> {
  return `${prefix}:${(await sha256Base64(value)).slice(0, 32)}`;
}
