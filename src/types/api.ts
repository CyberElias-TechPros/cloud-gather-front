/**
 * Response shapes returned by the CloudGather Worker API.
 * Keep these in sync with worker/src/routes/*.ts.
 */

/** Envelope returned by every paginated worker route (see core/pagination.ts). */
export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  pages: number;
  hasMore: boolean;
}

/* ------------------------------------------------------------- config */

export interface PlanLimits {
  storageBytes: number;
  maxFileSizeBytes: number;
  maxProviders: number;
  maxApiKeys: number;
  maxWebhooks: number;
  maxPublicLinks: number;
  versionHistory: number;
  apiRateLimitPerMinute: number;
  trashRetentionDays: number;
  seats: number;
}

/** Mirrors `Plan` in worker/src/billing/plans.ts — keep the two in step. */
export interface Plan {
  id: "free" | "pro" | "team" | "enterprise";
  name: string;
  tagline: string;
  description: string;
  /** Minor units (cents). `-1` means "priced on request". */
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  popular: boolean;
  order: number;
  limits: PlanLimits;
  features: string[];
  capabilities: string[];
  support: string;
  /** Only present on /billing/plans, where Stripe configuration is known. */
  purchasable?: boolean;
}

export interface Capabilities {
  email: boolean;
  encryption: boolean;
  billing: boolean;
  turnstile: boolean;
  social: Record<string, boolean>;
  providers: Record<string, boolean>;
}

export interface ProviderCredentialField {
  key: string;
  label: string;
  type: "text" | "password";
  required: boolean;
  placeholder?: string;
  helpText?: string;
}

export interface ProviderCatalogueEntry {
  id: string;
  name: string;
  kind: "oauth" | "credentials";
  description: string;
  docsUrl: string;
  available: boolean;
  configured: boolean;
  setupHint?: string;
  credentialFields: ProviderCredentialField[];
}

export interface AppConfig {
  app: { name: string; url: string; api_url: string; environment: string; version: string; production: boolean; support_email: string | null };
  policy: {
    registration_enabled: boolean;
    require_email_verification: boolean;
    maintenance_mode: boolean;
    maintenance_message: string;
    max_file_size_mb: number;
    trash_retention_days: number;
    allow_public_links: boolean;
    password: { min_length: number; require_mixed_case: boolean; require_number: boolean; require_symbol: boolean };
    signup_domain_allowlist: string[];
  };
  capabilities: Capabilities;
  /** Public Turnstile site key, present only when Turnstile is configured. */
  turnstile_site_key: string | null;
  social_providers: string[];
  storage_providers: ProviderCatalogueEntry[];
  roadmap_providers: { id: string; name: string; note: string }[];
  plans: Plan[];
  purchasable_plans: string[];
  api_scopes: string[];
  webhook_events: string[];
  contact_topics: string[];
  announcement: string | null;
}

/* -------------------------------------------------------- entitlements */

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
  storage_percent: number;
  capabilities: string[];
}

/* --------------------------------------------------------------- files */

export interface FileVersion {
  id: string;
  version: number;
  size: number;
  mime_type: string | null;
  note: string | null;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: string;
  created_at: string;
}

export interface FileStats {
  usage: Usage;
  limits: PlanLimits;
  plan: { id: string; name: string };
  storage_percent: number;
  by_category: { category: string; files: number; bytes: number }[];
  by_provider: { provider_id: string | null; provider_name: string | null; bytes: number; items: number }[];
  recent_uploads?: { day: string; bytes: number; files: number }[];
}

/* -------------------------------------------------------------- shares */

export interface ShareRecord {
  id: string;
  file_id: string;
  owner_id: string;
  shared_with_email: string | null;
  permission_level: "view" | "edit";
  message: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  access_count: number;
  last_accessed_at: string | null;
  created_at: string;
  filename?: string;
  mime_type?: string | null;
  size?: number;
  is_folder?: number | boolean;
  owner_name?: string;
  owner_email?: string;
}

export interface PublicLink {
  id: string;
  file_id: string;
  token_prefix: string;
  permission: "view" | "download";
  allow_download: number | boolean;
  max_downloads: number | null;
  download_count: number;
  view_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  last_accessed_at: string | null;
  note: string | null;
  created_at: string;
  has_password?: boolean;
  url?: string;
  token?: string;
  filename?: string;
  size?: number;
  mime_type?: string | null;
}

export interface LinkVisit {
  action: string;
  country: string | null;
  referrer: string | null;
  created_at: string;
}

/* ----------------------------------------------------------- providers */

export interface ConnectedProvider {
  id: string;
  provider_name: string;
  provider_user_email: string | null;
  display_name: string | null;
  status: "connected" | "syncing" | "error";
  total_space: number | null;
  used_space: number | null;
  priority: number;
  file_count: number;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
}

export interface RemoteEntry {
  id: string;
  name: string;
  path: string | null;
  isFolder: boolean;
  size: number | null;
  mimeType: string | null;
  modifiedAt: string | null;
  webUrl: string | null;
}

/* ------------------------------------------------------ notifications */

export interface NotificationRecord {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  data?: Record<string, unknown> | string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreferences {
  emailProductUpdates: boolean;
  emailSecurityAlerts: boolean;
  emailSharing: boolean;
  emailStorageAlerts: boolean;
  emailBilling: boolean;
  emailWeeklyDigest: boolean;
  inAppAll: boolean;
}

/* ------------------------------------------------------------ billing */

export interface Subscription {
  id: string;
  plan: string;
  status: string;
  interval: "monthly" | "yearly";
  provider_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: number | boolean;
  trial_ends_at: string | null;
}

export interface Invoice {
  id: string;
  number: string | null;
  amount_paid: number;
  currency: string;
  status: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

/* ------------------------------------------------------- keys/webhooks */

export interface ApiKeyRecord {
  id: string;
  name: string;
  description: string | null;
  key_prefix: string;
  permissions: string[];
  last_used_at: string | null;
  last_used_ip: string | null;
  use_count: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  key?: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  disabled_at: string | null;
  failure_count: number;
  last_success_at: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: string;
  attempts: number;
  response_status: number | null;
  response_body: string | null;
  next_attempt_at: string | null;
  created_at: string;
  delivered_at: string | null;
}

/* --------------------------------------------------------------- misc */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  level: "info" | "success" | "warning" | "critical";
  audience: string;
  starts_at: string | null;
  ends_at: string | null;
  published?: number | boolean;
  created_at?: string;
}

export interface SessionRecord {
  id: string;
  client: string | null;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
  last_seen_at: string | null;
  created_at: string;
  expires_at: string;
  current?: boolean;
}

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
  optional?: boolean;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  topic: string;
  message: string;
  status: "new" | "open" | "resolved" | "spam";
  reply: string | null;
  replied_at: string | null;
  created_at: string;
}

export interface StatusPayload {
  status: "operational" | "degraded" | "outage";
  updated_at: string;
  components: { id: string; name: string; status: "operational" | "degraded" | "outage" }[];
  incidents: Announcement[];
  metrics: Record<string, number>;
}
