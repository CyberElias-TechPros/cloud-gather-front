/**
 * System settings: admin-editable runtime configuration stored in D1 and cached
 * in the isolate for a short TTL so hot paths don't hit the database.
 */
import type { Env } from "../env";
import { all, run } from "./db";
import { parseJson } from "./util";

export interface SystemSettings {
  app_name: string;
  maintenance_mode: boolean;
  maintenance_message: string;
  registration_enabled: boolean;
  require_email_verification: boolean;
  max_file_size_mb: number;
  max_storage_per_user_gb: number;
  api_rate_limit_per_minute: number;
  password_min_length: number;
  password_require_mixed_case: boolean;
  password_require_number: boolean;
  password_require_symbol: boolean;
  audit_logging_enabled: boolean;
  trash_retention_days: number;
  file_version_limit: number;
  max_login_attempts: number;
  lockout_minutes: number;
  session_idle_timeout_days: number;
  allow_public_links: boolean;
  default_plan: string;
  support_email: string;
  announcement: string;
  signup_domain_allowlist: string;
}

export const DEFAULT_SETTINGS: SystemSettings = {
  app_name: "CloudGather",
  maintenance_mode: false,
  maintenance_message: "CloudGather is undergoing scheduled maintenance. We will be back shortly.",
  registration_enabled: true,
  require_email_verification: false,
  max_file_size_mb: 100,
  max_storage_per_user_gb: 10,
  api_rate_limit_per_minute: 120,
  password_min_length: 10,
  password_require_mixed_case: false,
  password_require_number: false,
  password_require_symbol: false,
  audit_logging_enabled: true,
  trash_retention_days: 30,
  file_version_limit: 10,
  max_login_attempts: 8,
  lockout_minutes: 15,
  session_idle_timeout_days: 30,
  allow_public_links: true,
  default_plan: "free",
  support_email: "support@cloudgather.app",
  announcement: "",
  signup_domain_allowlist: "",
};

/** Human-facing copy for the admin console. */
export const SETTING_DESCRIPTIONS: Record<keyof SystemSettings, string> = {
  app_name: "Product name used in emails and page titles.",
  maintenance_mode: "Blocks all non-admin API traffic and shows a maintenance notice.",
  maintenance_message: "Message shown to users while maintenance mode is on.",
  registration_enabled: "Allow new users to create accounts.",
  require_email_verification: "Require a verified email address before using the app.",
  max_file_size_mb: "Largest single upload accepted (plan limits may be lower).",
  max_storage_per_user_gb: "Default managed-storage quota for accounts without a paid plan.",
  api_rate_limit_per_minute: "Baseline request ceiling per identity per minute.",
  password_min_length: "Minimum password length for new and changed passwords.",
  password_require_mixed_case: "Require upper and lower case characters in passwords.",
  password_require_number: "Require at least one digit in passwords.",
  password_require_symbol: "Require at least one symbol in passwords.",
  audit_logging_enabled: "Persist an audit trail of user and admin actions.",
  trash_retention_days: "Days deleted items stay recoverable before permanent purge.",
  file_version_limit: "Number of historical versions retained per file.",
  max_login_attempts: "Failed sign-ins before an account is temporarily locked.",
  lockout_minutes: "How long an account stays locked after too many failures.",
  session_idle_timeout_days: "Days of inactivity before a session is revoked.",
  allow_public_links: "Allow users to create anonymous public share links.",
  default_plan: "Plan assigned to newly registered accounts.",
  support_email: "Reply-to address used on outbound email.",
  announcement: "Banner shown to every signed-in user (leave blank to hide).",
  signup_domain_allowlist: "Comma-separated email domains allowed to register (blank = all).",
};

interface CacheEntry {
  value: SystemSettings;
  expires: number;
}

let cache: CacheEntry | null = null;
const TTL_MS = 30_000;

export async function getSettings(env: Env): Promise<SystemSettings> {
  if (cache && cache.expires > Date.now()) return cache.value;
  let value: SystemSettings = { ...DEFAULT_SETTINGS };
  try {
    const rows = await all<{ key: string; value: string }>(env, "SELECT key, value FROM system_settings");
    for (const row of rows) {
      if (row.key in DEFAULT_SETTINGS) {
        const fallback = DEFAULT_SETTINGS[row.key as keyof SystemSettings];
        (value as unknown as Record<string, unknown>)[row.key] = parseJson(row.value, fallback as unknown);
      }
    }
  } catch {
    // A cold/unmigrated database should not take the API down.
  }
  cache = { value, expires: Date.now() + TTL_MS };
  return value;
}

export async function setSettings(env: Env, changes: { key: string; value: unknown }[]): Promise<void> {
  const valid = changes.filter((change) => change.key in DEFAULT_SETTINGS);
  for (const change of valid) {
    await run(
      env,
      `INSERT INTO system_settings(key, value, updated_at) VALUES(?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      change.key,
      JSON.stringify(change.value),
    );
  }
  cache = null;
}

export const invalidateSettingsCache = () => {
  cache = null;
};

export async function passwordPolicy(env: Env) {
  const settings = await getSettings(env);
  return {
    minLength: Number(settings.password_min_length) || 10,
    requireMixedCase: Boolean(settings.password_require_mixed_case),
    requireNumber: Boolean(settings.password_require_number),
    requireSymbol: Boolean(settings.password_require_symbol),
  };
}
