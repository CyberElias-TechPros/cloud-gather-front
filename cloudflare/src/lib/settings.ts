/**
 * System settings — the operator-tunable knobs, stored in D1 and cached briefly
 * in KV so the hot paths (upload checks, rate limits) stay cheap.
 */

import { cacheDelete, cacheGet, cachePut, nowIso, parseJson } from "./db";
import type { Env } from "../types";

export interface SettingDefinition {
  key: string;
  value: boolean | number | string;
  description: string;
  group: "general" | "storage" | "security" | "limits" | "features";
}

export const SETTINGS: SettingDefinition[] = [
  { key: "app_name", value: "CloudGather", description: "Product name shown across the interface", group: "general" },
  { key: "app_description", value: "One home for every cloud drive.", description: "Short product description used in metadata", group: "general" },
  { key: "app_version", value: "1.0.0", description: "Released application version", group: "general" },
  { key: "support_email", value: "support@cloudgather.app", description: "Address shown on help and legal pages", group: "general" },
  { key: "maintenance_mode", value: false, description: "When true, only administrators can use the app", group: "general" },
  { key: "registration_enabled", value: true, description: "Allow new accounts to be created", group: "features" },
  { key: "email_verification_required", value: false, description: "Require e-mail confirmation before uploading", group: "security" },
  { key: "allow_public_links", value: true, description: "Allow links that anyone with the URL can open", group: "features" },
  { key: "provider_sync_enabled", value: true, description: "Allow browsing and importing from connected drives", group: "features" },
  { key: "notify_on_share", value: true, description: "E-mail the recipient when a file is shared with them", group: "features" },
  { key: "max_file_size_mb", value: 100, description: "Largest single upload accepted, in megabytes", group: "storage" },
  { key: "default_quota_gb", value: 50, description: "Storage granted to a new account, in gigabytes", group: "storage" },
  { key: "allowed_file_types", value: "", description: "Comma separated list of allowed extensions; empty allows everything", group: "storage" },
  { key: "trash_retention_days", value: 30, description: "Days a deleted item stays recoverable", group: "storage" },
  { key: "session_ttl_days", value: 30, description: "How long a signed-in session stays valid", group: "security" },
  { key: "max_sessions_per_user", value: 10, description: "Maximum concurrent sessions per account", group: "security" },
  { key: "max_api_keys_per_user", value: 25, description: "Maximum active developer keys per account", group: "limits" },
  { key: "max_providers_per_user", value: 12, description: "Maximum connected drives per account", group: "limits" },
  { key: "api_rate_limit_per_minute", value: 120, description: "Developer API requests allowed per key per minute", group: "limits" },
  { key: "auth_rate_limit_per_15min", value: 30, description: "Authentication attempts allowed per address", group: "limits" },
  { key: "upload_rate_limit_per_hour", value: 300, description: "Uploads allowed per account per hour", group: "limits" },
  { key: "share_default_expiry_days", value: 30, description: "Default expiry applied to new share links", group: "features" },
  { key: "max_share_expiry_days", value: 365, description: "Upper bound for share link expiry", group: "features" },
];

export const SETTING_KEYS = SETTINGS.map((setting) => setting.key);

export type SettingsMap = Record<string, boolean | number | string>;

export const DEFAULT_SETTINGS: SettingsMap = Object.fromEntries(SETTINGS.map((setting) => [setting.key, setting.value]));

const CACHE_KEY = "settings:v1";

/**
 * Reads every setting. Individual rows may hold JSON (`true`, `120`, `"text"`),
 * while legacy plain strings are accepted too.
 */
export async function getSettings(env: Env): Promise<SettingsMap> {
  const cached = await cacheGet<SettingsMap>(env, CACHE_KEY);
  if (cached) return { ...DEFAULT_SETTINGS, ...cached };

  const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all<{ key: string; value: string }>();
  const overrides: SettingsMap = {};
  for (const row of results ?? []) {
    overrides[row.key] = parseJson<boolean | number | string>(row.value, row.value);
  }
  const merged = { ...DEFAULT_SETTINGS, ...overrides };
  await cachePut(env, CACHE_KEY, merged, 120);
  return merged;
}

export async function getSetting<T extends boolean | number | string>(env: Env, key: string, fallback: T): Promise<T> {
  const settings = await getSettings(env);
  const value = settings[key];
  return (value === undefined ? fallback : value) as T;
}

export async function updateSettings(env: Env, updates: Record<string, unknown>): Promise<string[]> {
  const statements: D1PreparedStatement[] = [];
  const accepted: string[] = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!SETTING_KEYS.includes(key)) continue;
    statements.push(
      env.DB.prepare(
        `INSERT INTO system_settings (key, value, description, updated_at)
         VALUES (?, ?, (SELECT description FROM system_settings WHERE key = ?), ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      ).bind(key, JSON.stringify(value), key, nowIso()),
    );
    accepted.push(key);
  }
  if (statements.length > 0) await env.DB.batch(statements);
  await cacheDelete(env, CACHE_KEY);
  return accepted;
}

export function numericSetting(settings: SettingsMap, key: string, fallback: number): number {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
}

export function booleanSetting(settings: SettingsMap, key: string, fallback = false): boolean {
  const value = settings[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true" || value === "1";
  if (typeof value === "number") return value !== 0;
  return fallback;
}

/** The shape published at `GET /api/config` — never includes secrets. */
export function publicConfig(env: Env, settings: SettingsMap) {
  return {
    appName: String(settings.app_name ?? "CloudGather"),
    appDescription: String(settings.app_description ?? ""),
    appVersion: String(settings.app_version ?? "1.0.0"),
    maintenanceMode: booleanSetting(settings, "maintenance_mode"),
    registrationEnabled: booleanSetting(settings, "registration_enabled", true),
    emailVerificationRequired: booleanSetting(settings, "email_verification_required"),
    allowPublicLinks: booleanSetting(settings, "allow_public_links", true),
    providerSyncEnabled: booleanSetting(settings, "provider_sync_enabled", true),
    maxFileSizeMb: numericSetting(settings, "max_file_size_mb", 100),
    defaultQuotaGb: numericSetting(settings, "default_quota_gb", 50),
    trashRetentionDays: numericSetting(settings, "trash_retention_days", 30),
    allowedFileTypes: String(settings.allowed_file_types ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    supportEmail: String(settings.support_email ?? "support@cloudgather.app"),
    environment: env.ENVIRONMENT ?? "development",
    emailDeliveryConfigured: Boolean(env.RESEND_API_KEY),
  };
}
