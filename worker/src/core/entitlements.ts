/**
 * Entitlements = plan limits + per-account overrides + instance defaults.
 * Every quota decision in the API funnels through here.
 */
import type { Env } from "../env";
import type { AuthUser } from "./context";
import { first } from "./db";
import { forbidden, tooLarge } from "./http";
import { getSettings } from "./settings";
import { getPlan, type Plan, type PlanLimits } from "../billing/plans";

export interface Usage {
  storageBytes: number;
  fileCount: number;
  folderCount: number;
  trashBytes: number;
  providerCount: number;
  apiKeyCount: number;
  webhookCount: number;
  publicLinkCount: number;
  shareCount: number;
}

export interface Entitlements {
  plan: Plan;
  limits: PlanLimits;
  usage: Usage;
  storagePercent: number;
  capabilities: string[];
}

export async function getUsage(env: Env, userId: string): Promise<Usage> {
  const row = await first<{
    storage_bytes: number; file_count: number; folder_count: number; trash_bytes: number;
    provider_count: number; api_key_count: number; webhook_count: number; link_count: number; share_count: number;
  }>(
    env,
    `SELECT
      (SELECT COALESCE(SUM(size),0) FROM files WHERE user_id = ?1 AND is_folder = 0 AND deleted_at IS NULL AND storage_kind = 'managed') AS storage_bytes,
      (SELECT COUNT(*) FROM files WHERE user_id = ?1 AND is_folder = 0 AND deleted_at IS NULL) AS file_count,
      (SELECT COUNT(*) FROM files WHERE user_id = ?1 AND is_folder = 1 AND deleted_at IS NULL) AS folder_count,
      (SELECT COALESCE(SUM(size),0) FROM files WHERE user_id = ?1 AND deleted_at IS NOT NULL) AS trash_bytes,
      (SELECT COUNT(*) FROM storage_providers WHERE user_id = ?1 AND status != 'disconnected') AS provider_count,
      (SELECT COUNT(*) FROM api_keys WHERE user_id = ?1 AND revoked_at IS NULL) AS api_key_count,
      (SELECT COUNT(*) FROM webhook_endpoints WHERE user_id = ?1 AND disabled_at IS NULL) AS webhook_count,
      (SELECT COUNT(*) FROM public_links WHERE owner_id = ?1 AND revoked_at IS NULL) AS link_count,
      (SELECT COUNT(*) FROM file_shares WHERE owner_id = ?1) AS share_count`,
    userId,
  );
  return {
    storageBytes: Number(row?.storage_bytes ?? 0),
    fileCount: Number(row?.file_count ?? 0),
    folderCount: Number(row?.folder_count ?? 0),
    trashBytes: Number(row?.trash_bytes ?? 0),
    providerCount: Number(row?.provider_count ?? 0),
    apiKeyCount: Number(row?.api_key_count ?? 0),
    webhookCount: Number(row?.webhook_count ?? 0),
    publicLinkCount: Number(row?.link_count ?? 0),
    shareCount: Number(row?.share_count ?? 0),
  };
}

export async function getEntitlements(env: Env, user: AuthUser): Promise<Entitlements> {
  const settings = await getSettings(env);
  const plan = getPlan(user.plan);
  const usage = await getUsage(env, user.id);

  const limits: PlanLimits = { ...plan.limits };
  // Instance-wide ceilings (admin configurable) and per-account overrides.
  if (user.plan === "free" && settings.max_storage_per_user_gb > 0) {
    limits.storageBytes = settings.max_storage_per_user_gb * 1024 ** 3;
  }
  if (user.storage_quota_bytes && user.storage_quota_bytes > 0) limits.storageBytes = user.storage_quota_bytes;
  const instanceMaxFile = (settings.max_file_size_mb || 100) * 1024 ** 2;
  if (limits.maxFileSizeBytes < 0 || limits.maxFileSizeBytes > instanceMaxFile) {
    limits.maxFileSizeBytes = Math.min(limits.maxFileSizeBytes < 0 ? instanceMaxFile : limits.maxFileSizeBytes, instanceMaxFile);
  }
  if (settings.trash_retention_days > 0) {
    limits.trashRetentionDays = Math.min(limits.trashRetentionDays, settings.trash_retention_days);
  }
  if (settings.file_version_limit > 0) {
    limits.versionHistory = Math.min(limits.versionHistory, settings.file_version_limit);
  }

  const storagePercent = limits.storageBytes > 0 ? Math.min(100, Math.round((usage.storageBytes / limits.storageBytes) * 100)) : 0;
  const capabilities = [...plan.capabilities];
  if (!settings.allow_public_links) {
    const index = capabilities.indexOf("public_links");
    if (index >= 0) capabilities.splice(index, 1);
  }

  return { plan, limits, usage, storagePercent, capabilities };
}

export function hasCapability(entitlements: Entitlements, capability: string): boolean {
  return entitlements.capabilities.includes(capability);
}

export function requireCapability(entitlements: Entitlements, capability: string, label: string): void {
  if (!hasCapability(entitlements, capability)) {
    throw forbidden(`${label} is not available on the ${entitlements.plan.name} plan.`, "plan_upgrade_required");
  }
}

/** Throws when an upload would exceed the account's storage or size limits. */
export function assertUploadAllowed(entitlements: Entitlements, byteSize: number): void {
  const { limits, usage } = entitlements;
  if (limits.maxFileSizeBytes > 0 && byteSize > limits.maxFileSizeBytes) {
    throw tooLarge(
      `This file is larger than the ${formatLimit(limits.maxFileSizeBytes)} per-file limit on the ${entitlements.plan.name} plan.`,
      "file_too_large",
    );
  }
  if (limits.storageBytes > 0 && usage.storageBytes + byteSize > limits.storageBytes) {
    throw forbidden(
      `This upload would exceed your ${formatLimit(limits.storageBytes)} storage quota. Empty the trash or upgrade your plan.`,
      "quota_exceeded",
    );
  }
}

export function assertWithinCount(current: number, limit: number, label: string, planName: string): void {
  if (limit >= 0 && current >= limit) {
    throw forbidden(`You've reached the ${label} limit (${limit}) for the ${planName} plan.`, "plan_limit_reached");
  }
}

function formatLimit(bytes: number): string {
  if (bytes < 0) return "unlimited";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${Math.round(bytes / 1024 ** exponent)} ${units[exponent]}`;
}
