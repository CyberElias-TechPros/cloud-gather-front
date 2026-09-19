/**
 * Password hashing with PBKDF2-SHA256 (WebCrypto).
 *
 * Iterations are stored per-user so the cost can be raised over time without
 * invalidating existing credentials: on a successful login with an outdated
 * iteration count the hash is transparently re-derived.
 */

import { base64ToBytes, base64url, timingSafeEqual } from "./crypto";

export const DEFAULT_ITERATIONS = 120_000;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

const encoder = new TextEncoder();

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
  algo: "PBKDF2-SHA256";
}

function toBase64(bytes: Uint8Array): string {
  return base64url(bytes);
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<PasswordHash> {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const derived = await derive(password, salt, iterations);
  return { hash: toBase64(derived), salt: toBase64(salt), iterations, algo: "PBKDF2-SHA256" };
}

export async function verifyPassword(
  password: string,
  stored: { password_hash: string; password_salt: string; password_iterations: number },
): Promise<boolean> {
  const salt = base64ToBytes(stored.password_salt);
  const derived = await derive(password, salt, stored.password_iterations || DEFAULT_ITERATIONS);
  return timingSafeEqual(toBase64(derived), stored.password_hash);
}

export interface PasswordStrength {
  valid: boolean;
  score: number; // 0..4
  problems: string[];
}

/** Mirrors the client-side meter; the server is the authority. */
export function checkPasswordStrength(password: string): PasswordStrength {
  const problems: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) problems.push(`Use at least ${MIN_PASSWORD_LENGTH} characters`);
  if (password.length > MAX_PASSWORD_LENGTH) problems.push("Password is too long");
  if (!/[a-z]/.test(password)) problems.push("Add a lowercase letter");
  if (!/[A-Z]/.test(password)) problems.push("Add an uppercase letter");
  if (!/[0-9]/.test(password)) problems.push("Add a number");
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return { valid: problems.length === 0, score: Math.min(score, 4), problems };
}

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "qwerty123",
  "letmein1", "welcome1", "iloveyou", "admin123", "cloudgather", "changeme",
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
