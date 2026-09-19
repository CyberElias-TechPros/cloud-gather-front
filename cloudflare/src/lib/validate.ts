/**
 * Request validation. Every validator either returns a clean value or throws an
 * `ApiError` naming the field, which keeps route handlers free of `if (!x)` noise
 * and produces consistent error messages.
 */

import { ApiError, badRequest, unprocessable } from "./http";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function body<T = Record<string, unknown>>(input: unknown): Record<string, unknown> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    throw badRequest("Expected a JSON object.");
  }
  return input as Record<string, unknown>;
}

export function field(input: Record<string, unknown>, name: string): unknown {
  return input[name];
}

export function requireString(
  input: Record<string, unknown>,
  name: string,
  options: { min?: number; max?: number; label?: string; trim?: boolean } = {},
): string {
  const value = input[name];
  if (typeof value !== "string") throw unprocessable(`${options.label ?? name} is required.`);
  const text = options.trim === false ? value : value.trim();
  if (text.length < (options.min ?? 1)) throw unprocessable(`${options.label ?? name} is required.`);
  if (options.max && text.length > options.max) {
    throw unprocessable(`${options.label ?? name} must be at most ${options.max} characters.`);
  }
  return text;
}

export function optionalString(
  input: Record<string, unknown>,
  name: string,
  options: { max?: number; label?: string } = {},
): string | undefined {
  const value = input[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw unprocessable(`${options.label ?? name} must be text.`);
  const text = value.trim();
  if (!text) return undefined;
  if (options.max && text.length > options.max) {
    throw unprocessable(`${options.label ?? name} must be at most ${options.max} characters.`);
  }
  return text;
}

export function requireEmail(input: Record<string, unknown>, name = "email"): string {
  const value = requireString(input, name, { label: "Email address", max: 254 });
  if (!EMAIL_PATTERN.test(value)) throw unprocessable("That does not look like an email address.");
  return value.toLowerCase();
}

export function optionalEmail(input: Record<string, unknown>, name: string): string | undefined {
  const value = optionalString(input, name, { label: "Email address", max: 254 });
  if (!value) return undefined;
  if (!EMAIL_PATTERN.test(value)) throw unprocessable("That does not look like an email address.");
  return value.toLowerCase();
}

export function requirePassword(input: Record<string, unknown>, name = "password"): string {
  const value = input[name];
  if (typeof value !== "string" || !value) throw unprocessable("Password is required.");
  if (value.length > 200) throw unprocessable("Passwords are limited to 200 characters.");
  return value;
}

export function optionalInt(
  input: Record<string, unknown>,
  name: string,
  options: { min?: number; max?: number; label?: string } = {},
): number | undefined {
  const value = input[name];
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) throw unprocessable(`${options.label ?? name} must be a whole number.`);
  if (options.min !== undefined && parsed < options.min) throw unprocessable(`${options.label ?? name} must be at least ${options.min}.`);
  if (options.max !== undefined && parsed > options.max) throw unprocessable(`${options.label ?? name} must be at most ${options.max}.`);
  return parsed;
}

export function requireInt(
  input: Record<string, unknown>,
  name: string,
  options: { min?: number; max?: number; label?: string; fallback?: number } = {},
): number {
  const parsed = optionalInt(input, name, options);
  if (parsed === undefined) {
    if (options.fallback !== undefined) return options.fallback;
    throw unprocessable(`${options.label ?? name} is required.`);
  }
  return parsed;
}

export function optionalBool(input: Record<string, unknown>, name: string): boolean | undefined {
  const value = input[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  throw unprocessable(`${name} must be true or false.`);
}

export function requireBool(input: Record<string, unknown>, name: string, fallback = false): boolean {
  return optionalBool(input, name) ?? fallback;
}

export function optionalArray(input: Record<string, unknown>, name: string, max = 100): unknown[] | undefined {
  const value = input[name];
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw unprocessable(`${name} must be a list.`);
  if (value.length > max) throw unprocessable(`${name} accepts at most ${max} items.`);
  return value;
}

export function optionalEnum<T extends string>(input: Record<string, unknown>, name: string, allowed: readonly T[]): T | undefined {
  const value = input[name];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw unprocessable(`${name} must be one of: ${allowed.join(", ")}.`);
  }
  return value as T;
}

/** Reads a query parameter, ignoring blanks and `undefined` strings. */
export function queryValue(url: URL, name: string): string | undefined {
  const value = url.searchParams.get(name);
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "undefined" || trimmed === "null") return undefined;
  return trimmed;
}

export function queryInt(url: URL, name: string, options: { min?: number; max?: number; fallback: number }): number {
  const raw = queryValue(url, name);
  const parsed = raw === undefined ? options.fallback : Number(raw);
  if (!Number.isFinite(parsed)) return options.fallback;
  const rounded = Math.trunc(parsed);
  if (options.min !== undefined && rounded < options.min) return options.min;
  if (options.max !== undefined && rounded > options.max) return options.max;
  return rounded;
}

export function queryBool(url: URL, name: string): boolean {
  const raw = queryValue(url, name);
  return raw === "true" || raw === "1";
}

export function assert(condition: unknown, message: string, details?: unknown): asserts condition {
  if (!condition) throw new ApiError("unprocessable", message, details);
}

/** Rejects identifiers that are obviously not ours before they hit the database. */
export function requireId(input: Record<string, unknown>, name: string, prefix?: string): string {
  const value = requireString(input, name, { label: "Identifier", max: 120 });
  if (prefix && !value.startsWith(`${prefix}_`)) throw badRequest("Invalid identifier.");
  return value;
}
