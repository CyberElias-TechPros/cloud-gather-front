import type { AppConfig, Plan } from "@/types/api";

/** Plan shaped exactly like worker/src/billing/plans.ts emits it. */
export const makePlan = (overrides: Partial<Plan> = {}): Plan => ({
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
    storageBytes: 200 * 1024 ** 3,
    maxFileSizeBytes: 5 * 1024 ** 3,
    maxProviders: -1,
    maxApiKeys: 10,
    maxWebhooks: 5,
    maxPublicLinks: 100,
    versionHistory: 30,
    apiRateLimitPerMinute: 300,
    trashRetentionDays: 60,
    seats: 1,
  },
  features: ["Unlimited connected cloud accounts", "200 GB of CloudGather-managed storage"],
  capabilities: ["files", "sharing", "api"],
  support: "Priority email support",
  ...overrides,
});

export const makeConfig = (overrides: Partial<AppConfig> = {}): AppConfig =>
  ({
    app: {
      name: "CloudGather",
      url: "http://localhost:8080",
      api_url: "http://localhost:8787/api",
      environment: "test",
      version: "1.0.0",
      production: false,
      support_email: "support@example.com",
    },
    policy: {
      registration_enabled: true,
      require_email_verification: false,
      maintenance_mode: false,
      maintenance_message: "",
      max_file_size_mb: 100,
      trash_retention_days: 30,
      allow_public_links: true,
      password: { min_length: 10, require_mixed_case: false, require_number: false, require_symbol: false },
    },
    capabilities: {
      email: false,
      encryption: true,
      billing: false,
      turnstile: false,
      social: {},
      providers: {},
    },
    turnstile_site_key: null,
    social_providers: [],
    storage_providers: [],
    plans: [
      makePlan({ id: "free", name: "Free", priceMonthly: 0, priceYearly: 0, popular: false, order: 1 }),
      makePlan(),
    ],
    purchasable_plans: [],
    contact_topics: ["general", "support"],
    announcement: null,
    ...overrides,
  }) as AppConfig;
