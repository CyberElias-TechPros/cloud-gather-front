/** Shared Worker types: bindings, request context and row shapes. */

export interface Env {
  // Bindings
  DB: D1Database;
  FILES: R2Bucket;
  CACHE: KVNamespace;
  JOBS: Queue<JobMessage>;

  // Vars (wrangler.toml [vars])
  ENVIRONMENT: string;
  APP_NAME: string;
  APP_URL: string;
  SUPPORT_EMAIL?: string;
  CORS_ALLOWED_ORIGINS?: string;

  // Secrets (wrangler secret put / .dev.vars)
  SESSION_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ADMIN_EMAIL?: string;
  PASSWORD_ITERATIONS?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  BOX_CLIENT_ID?: string;
  BOX_CLIENT_SECRET?: string;
}

export interface JobMessage {
  type: "email.send" | "provider.import" | "provider.sync";
  [key: string]: unknown;
}

export interface UserRow {
  id: string;
  email: string;
  email_normalized: string;
  email_verified: number;
  display_name: string | null;
  avatar_url: string | null;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  password_algo: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  storage_quota_bytes: number;
  settings: string;
  last_login_at: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface FileRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  path: string;
  size: number;
  mime_type: string | null;
  is_folder: number;
  provider_id: string | null;
  provider_file_id: string | null;
  storage_key: string | null;
  checksum: string | null;
  starred: number;
  share_count: number;
  trashed_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderRow {
  id: string;
  user_id: string;
  provider_name: string;
  display_name: string;
  status: "connected" | "disconnected" | "error";
  account_email: string | null;
  account_label: string | null;
  total_space: number | null;
  used_space: number | null;
  priority: number;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  scope: string | null;
  metadata: string;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderConfigRow {
  provider_name: string;
  display_name: string;
  auth_type: "oauth" | "credentials" | "managed";
  client_id: string | null;
  client_secret: string | null;
  scopes: string | null;
  authorize_url: string | null;
  token_url: string | null;
  is_enabled: number;
  is_configured: number;
  updated_at: string;
}

export interface ShareRow {
  id: string;
  file_id: string;
  owner_id: string;
  token: string;
  recipient_email: string | null;
  recipient_user_id: string | null;
  permission: "view" | "edit";
  password_hash: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  view_count: number;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  permissions: string;
  request_count: number;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ShareRowExport {
  id: string;
  file_id: string;
  owner_id: string;
  token: string;
  recipient_email: string | null;
  recipient_user_id: string | null;
  permission: "view" | "edit";
  password_hash: string | null;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  view_count: number;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AuthUser {
  user: UserRow;
  session?: SessionRow;
  apiKey?: ApiKeyRow;
}

/** Per-request state passed to every handler. */
export interface RequestContext {
  env: Env;
  req: Request;
  url: URL;
  params: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  requestId: string;
  state: Record<string, unknown>;
}
