/**
 * Plan catalogue — the single source of truth for pricing, limits and feature
 * gating. The frontend fetches this from `/api/billing/plans`, so marketing
 * pages and enforcement can never drift apart.
 */
import type { Env } from "../env";

export type PlanId = "free" | "pro" | "team" | "enterprise";
export type BillingInterval = "monthly" | "yearly";

export interface PlanLimits {
  /** Bytes of CloudGather-managed storage (files uploaded to CloudGather itself). */
  storageBytes: number;
  /** Largest single upload. */
  maxFileSizeBytes: number;
  /** Connected cloud accounts. -1 = unlimited. */
  maxProviders: number;
  maxApiKeys: number;
  maxWebhooks: number;
  maxPublicLinks: number;
  /** Retained historical versions per file. */
  versionHistory: number;
  /** API requests per minute for this plan's keys. */
  apiRateLimitPerMinute: number;
  trashRetentionDays: number;
  seats: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  priceMonthly: number; // minor units (cents)
  priceYearly: number;
  currency: string;
  popular: boolean;
  order: number;
  limits: PlanLimits;
  features: string[];
  /** Feature flags checked by `entitlements`. */
  capabilities: string[];
  support: string;
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Gather your personal clouds",
    description: "Everything you need to unify personal cloud accounts in one searchable place.",
    priceMonthly: 0,
    priceYearly: 0,
    currency: "usd",
    popular: false,
    order: 1,
    limits: {
      storageBytes: 5 * GB,
      maxFileSizeBytes: 100 * MB,
      maxProviders: 3,
      maxApiKeys: 2,
      maxWebhooks: 1,
      maxPublicLinks: 10,
      versionHistory: 3,
      apiRateLimitPerMinute: 60,
      trashRetentionDays: 14,
      seats: 1,
    },
    features: [
      "Up to 3 connected cloud accounts",
      "5 GB of CloudGather-managed storage",
      "Unified browsing, search and recents",
      "Email + link sharing with expiry",
      "2 API keys, 60 requests/minute",
      "14-day trash recovery",
    ],
    capabilities: ["files", "sharing", "api", "public_links"],
    support: "Community support",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For power users and freelancers",
    description: "Unlimited connections, deep version history and priority support.",
    priceMonthly: 900,
    priceYearly: 9000,
    currency: "usd",
    popular: true,
    order: 2,
    limits: {
      storageBytes: 200 * GB,
      maxFileSizeBytes: 5 * 1024 * MB,
      maxProviders: -1,
      maxApiKeys: 10,
      maxWebhooks: 10,
      maxPublicLinks: 500,
      versionHistory: 30,
      apiRateLimitPerMinute: 300,
      trashRetentionDays: 60,
      seats: 1,
    },
    features: [
      "Unlimited connected cloud accounts",
      "200 GB of CloudGather-managed storage",
      "5 GB uploads with resumable transfers",
      "30 versions per file, 60-day trash",
      "Password-protected & download-limited links",
      "10 API keys, webhooks, 300 requests/minute",
      "Priority email support",
    ],
    capabilities: ["files", "sharing", "api", "public_links", "webhooks", "versions", "password_links", "advanced_search", "priority_support"],
    support: "Priority email support",
  },
  {
    id: "team",
    name: "Team",
    tagline: "Shared workspaces and controls",
    description: "Everything in Pro plus shared administration, audit exports and SSO-ready controls.",
    priceMonthly: 2400,
    priceYearly: 24000,
    currency: "usd",
    popular: false,
    order: 3,
    limits: {
      storageBytes: 2048 * GB,
      maxFileSizeBytes: 20 * 1024 * MB,
      maxProviders: -1,
      maxApiKeys: 50,
      maxWebhooks: 50,
      maxPublicLinks: -1,
      versionHistory: 100,
      apiRateLimitPerMinute: 1200,
      trashRetentionDays: 120,
      seats: 10,
    },
    features: [
      "Everything in Pro",
      "2 TB pooled managed storage",
      "10 seats with role-based access",
      "Audit-log export and retention controls",
      "Unlimited public links and webhooks",
      "1,200 requests/minute API ceiling",
      "Onboarding assistance",
    ],
    capabilities: [
      "files", "sharing", "api", "public_links", "webhooks", "versions", "password_links",
      "advanced_search", "priority_support", "audit_export", "seats", "sso_ready",
    ],
    support: "Priority support with 1 business-day SLA",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    tagline: "Custom scale and compliance",
    description: "Dedicated limits, custom contracts, DPA and security review support.",
    priceMonthly: -1,
    priceYearly: -1,
    currency: "usd",
    popular: false,
    order: 4,
    limits: {
      storageBytes: -1,
      maxFileSizeBytes: 100 * 1024 * MB,
      maxProviders: -1,
      maxApiKeys: -1,
      maxWebhooks: -1,
      maxPublicLinks: -1,
      versionHistory: 365,
      apiRateLimitPerMinute: 6000,
      trashRetentionDays: 365,
      seats: -1,
    },
    features: [
      "Everything in Team",
      "Unlimited storage and seats",
      "Custom data residency and retention",
      "SAML/SCIM onboarding support",
      "DPA, security review and custom SLA",
      "Dedicated success manager",
    ],
    capabilities: [
      "files", "sharing", "api", "public_links", "webhooks", "versions", "password_links",
      "advanced_search", "priority_support", "audit_export", "seats", "sso_ready", "custom_retention", "dedicated_support",
    ],
    support: "Dedicated success manager",
  },
];

export const getPlan = (planId: string | null | undefined): Plan => PLANS.find((plan) => plan.id === planId) || PLANS[0];

export const isPaidPlan = (planId: string) => planId !== "free" && PLANS.some((plan) => plan.id === planId);

/** Maps a plan+interval to the configured Stripe price ID. */
export function stripePriceId(env: Env, planId: PlanId, interval: BillingInterval): string | null {
  const key = `STRIPE_PRICE_${planId.toUpperCase()}_${interval.toUpperCase()}` as keyof Env;
  const value = env[key];
  return typeof value === "string" && value ? value : null;
}

/** Reverse lookup used by the Stripe webhook to apply the right plan. */
export function planFromPriceId(env: Env, priceId: string): { planId: PlanId; interval: BillingInterval } | null {
  for (const plan of PLANS) {
    for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
      if (stripePriceId(env, plan.id, interval) === priceId) return { planId: plan.id, interval };
    }
  }
  return null;
}

/** Plans that can be self-served with the current configuration. */
export function purchasablePlans(env: Env): PlanId[] {
  return PLANS.filter((plan) => plan.id !== "free" && plan.priceMonthly > 0)
    .filter((plan) => stripePriceId(env, plan.id, "monthly") || stripePriceId(env, plan.id, "yearly"))
    .map((plan) => plan.id);
}
