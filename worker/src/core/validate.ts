/** Input validation helpers that throw user-safe HttpErrors. */
import { badRequest, unprocessable } from "./http";
import { isEmail, normalizeEmail } from "./util";

/** Characters that break object keys, paths or shell-ish contexts. */
const UNSAFE_NAME = /[/\\<>:"|?*\u0000-\u001f]/;

export function requireString(value: unknown, label: string, { min = 1, max = 500 } = {}): string {
  if (typeof value !== "string" || value.trim().length < min) throw badRequest(`${label} is required.`, "validation_error");
  const trimmed = value.trim();
  if (trimmed.length > max) throw badRequest(`${label} must be ${max} characters or fewer.`, "validation_error");
  return trimmed;
}

export function optionalString(value: unknown, label: string, max = 500): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requireString(value, label, { max });
}

export function requireEmail(value: unknown, label = "Email"): string {
  const email = normalizeEmail(value);
  if (!isEmail(email)) throw badRequest(`${label} is not a valid email address.`, "validation_error");
  return email;
}

export function requireFileName(value: unknown, label = "Name"): string {
  const name = requireString(value, label, { max: 255 });
  if (UNSAFE_NAME.test(name) || name === "." || name === "..") throw badRequest(`${label} contains characters that are not allowed.`, "validation_error");
  return name;
}

export function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw badRequest(`${label} must be one of: ${allowed.join(", ")}.`, "validation_error");
  }
  return value as T;
}

export function optionalEnum<T extends string>(value: unknown, allowed: readonly T[], label: string, fallback: T): T {
  if (value === undefined || value === null || value === "") return fallback;
  return requireEnum(value, allowed, label);
}

export function requireBoolean(value: unknown, label: string): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  throw badRequest(`${label} must be true or false.`, "validation_error");
}

export function requireArray<T>(value: unknown, label: string, max = 500): T[] {
  if (!Array.isArray(value)) throw badRequest(`${label} must be an array.`, "validation_error");
  if (value.length > max) throw badRequest(`${label} may contain at most ${max} items.`, "validation_error");
  return value as T[];
}

export function optionalIsoDate(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} is not a valid date.`, "validation_error");
  return date.toISOString();
}

export function optionalUrl(value: unknown, label: string, { requireHttps = false } = {}): string | null {
  if (value === undefined || value === null || value === "") return null;
  let parsed: URL;
  try {
    parsed = new URL(String(value));
  } catch {
    throw badRequest(`${label} must be a valid URL.`, "validation_error");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) throw badRequest(`${label} must use http or https.`, "validation_error");
  if (requireHttps && parsed.protocol !== "https:") throw badRequest(`${label} must use https.`, "validation_error");
  return parsed.toString();
}

export interface PasswordPolicy {
  minLength: number;
  requireMixedCase?: boolean;
  requireNumber?: boolean;
  requireSymbol?: boolean;
}

/** Password strength check, driven by admin-configurable policy. */
export function validatePassword(value: unknown, policy: PasswordPolicy = { minLength: 10 }): string {
  if (typeof value !== "string") throw badRequest("Password is required.", "validation_error");
  const issues: string[] = [];
  if (value.length < policy.minLength) issues.push(`at least ${policy.minLength} characters`);
  if (value.length > 256) throw badRequest("Password must be 256 characters or fewer.", "validation_error");
  if (policy.requireMixedCase && !(/[a-z]/.test(value) && /[A-Z]/.test(value))) issues.push("upper and lower case letters");
  if (policy.requireNumber && !/\d/.test(value)) issues.push("a number");
  if (policy.requireSymbol && !/[^\w\s]/.test(value)) issues.push("a symbol");
  if (COMMON_PASSWORDS.has(value.toLowerCase())) throw unprocessable("That password is too common. Choose something harder to guess.", "weak_password");
  if (issues.length) throw unprocessable(`Password must contain ${issues.join(", ")}.`, "weak_password", { issues });
  return value;
}

/** Deliberately small: a real deployment can extend this from a blocklist file. */
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890", "qwertyuiop",
  "letmein123", "welcome123", "iloveyou1", "admin12345", "cloudgather", "changeme123",
]);

/** Estimated strength 0-4 for UI meters (mirrors the frontend implementation). */
export function passwordScore(value: string): number {
  let score = 0;
  if (value.length >= 10) score += 1;
  if (value.length >= 14) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) && /[^\w\s]/.test(value)) score += 1;
  if (COMMON_PASSWORDS.has(value.toLowerCase())) return 0;
  return Math.min(4, score);
}
