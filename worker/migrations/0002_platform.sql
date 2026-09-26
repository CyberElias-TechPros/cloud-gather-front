-- CloudGather platform schema: accounts lifecycle, trash, versions, public links,
-- providers with credentials, billing, notifications, webhooks, support inbox.

/* ---------------------------------------------------------------- users */
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled_at TEXT;
ALTER TABLE users ADD COLUMN storage_quota_bytes INTEGER;
ALTER TABLE users ADD COLUMN onboarded_at TEXT;
ALTER TABLE users ADD COLUMN last_login_at TEXT;
ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
ALTER TABLE users ADD COLUMN password_changed_at TEXT;
ALTER TABLE users ADD COLUMN delete_requested_at TEXT;
ALTER TABLE users ADD COLUMN purge_at TEXT;
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';
ALTER TABLE users ADD COLUMN timezone TEXT;
ALTER TABLE users ADD COLUMN marketing_opt_in INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

/* ------------------------------------------------------------- sessions */
ALTER TABLE sessions ADD COLUMN revoked_at TEXT;
ALTER TABLE sessions ADD COLUMN last_seen_at TEXT;
ALTER TABLE sessions ADD COLUMN ip_address TEXT;
ALTER TABLE sessions ADD COLUMN user_agent TEXT;
ALTER TABLE sessions ADD COLUMN location TEXT;
ALTER TABLE sessions ADD COLUMN client TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, created_at DESC);

/* ---------------------------------------------------------------- files */
ALTER TABLE files ADD COLUMN deleted_at TEXT;
ALTER TABLE files ADD COLUMN purge_at TEXT;
ALTER TABLE files ADD COLUMN storage_kind TEXT NOT NULL DEFAULT 'managed';
ALTER TABLE files ADD COLUMN r2_key TEXT;
ALTER TABLE files ADD COLUMN checksum TEXT;
ALTER TABLE files ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE files ADD COLUMN thumbnail_key TEXT;
ALTER TABLE files ADD COLUMN last_accessed_at TEXT;
ALTER TABLE files ADD COLUMN download_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE files ADD COLUMN description TEXT;
ALTER TABLE files ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE files ADD COLUMN category TEXT;
ALTER TABLE files ADD COLUMN provider_path TEXT;
ALTER TABLE files ADD COLUMN provider_modified_at TEXT;
ALTER TABLE files ADD COLUMN web_url TEXT;

UPDATE files SET r2_key = provider_file_id WHERE r2_key IS NULL AND provider_id IS NULL;
UPDATE files SET storage_kind = CASE WHEN provider_id IS NULL THEN 'managed' ELSE 'provider' END;

-- Trash keeps names, so uniqueness only applies to live rows.
DROP INDEX IF EXISTS files_unique_name;
CREATE UNIQUE INDEX files_unique_live_name
  ON files(user_id, COALESCE(parent_folder_id, ''), filename)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_files_live ON files(user_id, deleted_at, parent_folder_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_trash ON files(user_id, deleted_at DESC) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_files_starred ON files(user_id, is_starred) WHERE is_starred = 1;
CREATE INDEX IF NOT EXISTS idx_files_recent ON files(user_id, last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_files_provider ON files(provider_id, provider_file_id);

/* ------------------------------------------------------- file versions */
CREATE TABLE file_versions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  r2_key TEXT NOT NULL,
  checksum TEXT,
  created_by TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_file_versions ON file_versions(file_id, version DESC);

/* ----------------------------------------------------- upload sessions */
CREATE TABLE upload_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  parent_folder_id TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  r2_key TEXT NOT NULL,
  multipart_id TEXT,
  parts TEXT NOT NULL DEFAULT '[]',
  bytes_received INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  file_id TEXT,
  replace_file_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);
CREATE INDEX idx_upload_sessions_user ON upload_sessions(user_id, status);

/* ---------------------------------------------------------- public links */
CREATE TABLE public_links (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  permission TEXT NOT NULL DEFAULT 'view',
  allow_download INTEGER NOT NULL DEFAULT 1,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT,
  revoked_at TEXT,
  last_accessed_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_public_links_owner ON public_links(owner_id, created_at DESC);
CREATE INDEX idx_public_links_file ON public_links(file_id);

CREATE TABLE public_link_visits (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES public_links(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'view',
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  referrer TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_link_visits ON public_link_visits(link_id, created_at DESC);

/* ---------------------------------------------------------- file shares */
ALTER TABLE file_shares ADD COLUMN shared_with_id TEXT;
ALTER TABLE file_shares ADD COLUMN message TEXT;
ALTER TABLE file_shares ADD COLUMN access_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE file_shares ADD COLUMN last_accessed_at TEXT;
ALTER TABLE file_shares ADD COLUMN revoked_at TEXT;
CREATE INDEX IF NOT EXISTS idx_shares_recipient ON file_shares(shared_with_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_file ON file_shares(file_id);

/* ----------------------------------------------------- storage providers */
ALTER TABLE storage_providers ADD COLUMN display_name TEXT;
ALTER TABLE storage_providers ADD COLUMN account_id TEXT;
ALTER TABLE storage_providers ADD COLUMN access_token TEXT;
ALTER TABLE storage_providers ADD COLUMN refresh_token TEXT;
ALTER TABLE storage_providers ADD COLUMN token_expires_at TEXT;
ALTER TABLE storage_providers ADD COLUMN scopes TEXT;
ALTER TABLE storage_providers ADD COLUMN root_folder_id TEXT;
ALTER TABLE storage_providers ADD COLUMN config TEXT NOT NULL DEFAULT '{}';
ALTER TABLE storage_providers ADD COLUMN last_sync_at TEXT;
ALTER TABLE storage_providers ADD COLUMN last_error TEXT;
ALTER TABLE storage_providers ADD COLUMN sync_cursor TEXT;
ALTER TABLE storage_providers ADD COLUMN file_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE storage_providers ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;

/* --------------------------------------------- provider file index cache */
CREATE TABLE provider_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES storage_providers(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  parent_remote_id TEXT,
  name TEXT NOT NULL,
  path TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  is_folder INTEGER NOT NULL DEFAULT 0,
  web_url TEXT,
  modified_at TEXT,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider_id, remote_id)
);
CREATE INDEX idx_provider_files_user ON provider_files(user_id, name);
CREATE INDEX idx_provider_files_parent ON provider_files(provider_id, parent_remote_id);

/* ------------------------------------------------------------- api keys */
ALTER TABLE api_keys ADD COLUMN revoked_at TEXT;
ALTER TABLE api_keys ADD COLUMN expires_at TEXT;
ALTER TABLE api_keys ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN last_used_ip TEXT;
ALTER TABLE api_keys ADD COLUMN description TEXT;

/* --------------------------------------------------------- identities */
CREATE TABLE user_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, subject)
);
CREATE INDEX idx_identities_user ON user_identities(user_id);

CREATE TABLE oauth_states (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  user_id TEXT,
  redirect_uri TEXT,
  return_to TEXT,
  code_verifier TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE mfa_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE TABLE recovery_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_recovery_codes_user ON recovery_codes(user_id);

CREATE TABLE email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

/* --------------------------------------------------------- notifications */
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  data TEXT NOT NULL DEFAULT '{}',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read_at);

CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  tag TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  provider TEXT,
  last_error TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_email_outbox_status ON email_outbox(status, created_at);

/* -------------------------------------------------------------- webhooks */
CREATE TABLE webhook_endpoints (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  description TEXT,
  secret TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '["*"]',
  disabled_at TEXT,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_success_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_webhooks_user ON webhook_endpoints(user_id);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  endpoint_id TEXT NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  response_status INTEGER,
  response_body TEXT,
  next_attempt_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_deliveries_endpoint ON webhook_deliveries(endpoint_id, created_at DESC);
CREATE INDEX idx_deliveries_pending ON webhook_deliveries(status, next_attempt_at);

/* --------------------------------------------------------------- billing */
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  interval TEXT NOT NULL DEFAULT 'monthly',
  provider TEXT NOT NULL DEFAULT 'stripe',
  provider_subscription_id TEXT,
  provider_customer_id TEXT,
  price_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  canceled_at TEXT,
  trial_ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);
CREATE INDEX idx_subscriptions_provider ON subscriptions(provider_subscription_id);

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_invoice_id TEXT UNIQUE,
  number TEXT,
  amount_due INTEGER NOT NULL DEFAULT 0,
  amount_paid INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'draft',
  hosted_invoice_url TEXT,
  invoice_pdf TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_invoices_user ON invoices(user_id, created_at DESC);

CREATE TABLE billing_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT UNIQUE,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  processed_at TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/* --------------------------------------------------------- support inbox */
CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  reply TEXT,
  replied_at TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_contact_status ON contact_messages(status, created_at DESC);

CREATE TABLE newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  source TEXT,
  confirmed_at TEXT,
  unsubscribed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  audience TEXT NOT NULL DEFAULT 'all',
  starts_at TEXT,
  ends_at TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE saved_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

/* ----------------------------------------------------------- rate limits */
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_rate_limits_expiry ON rate_limits(expires_at);

/* ----------------------------------------------------------- audit logs */
ALTER TABLE audit_logs ADD COLUMN actor_email TEXT;
ALTER TABLE audit_logs ADD COLUMN ip_address TEXT;
ALTER TABLE audit_logs ADD COLUMN user_agent TEXT;
ALTER TABLE audit_logs ADD COLUMN severity TEXT NOT NULL DEFAULT 'info';
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC);

/* ------------------------------------------------------------ blog posts */
ALTER TABLE blog_posts ADD COLUMN author_id TEXT;
ALTER TABLE blog_posts ADD COLUMN reading_minutes INTEGER NOT NULL DEFAULT 4;
ALTER TABLE blog_posts ADD COLUMN seo_title TEXT;
ALTER TABLE blog_posts ADD COLUMN seo_description TEXT;
ALTER TABLE blog_posts ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE blog_posts ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_blog_published ON blog_posts(published, published_at DESC);

/* -------------------------------------------------------- system settings */
INSERT OR IGNORE INTO system_settings(key, value) VALUES
  ('maintenance_message', '"CloudGather is undergoing scheduled maintenance. We will be back shortly."'),
  ('require_email_verification', 'false'),
  ('password_require_mixed_case', 'false'),
  ('password_require_number', 'false'),
  ('password_require_symbol', 'false'),
  ('trash_retention_days', '30'),
  ('file_version_limit', '10'),
  ('max_login_attempts', '8'),
  ('lockout_minutes', '15'),
  ('session_idle_timeout_days', '30'),
  ('allow_public_links', 'true'),
  ('default_plan', '"free"'),
  ('support_email', '"support@cloudgather.app"'),
  ('announcement', '""'),
  ('signup_domain_allowlist', '""');
UPDATE system_settings SET value = '120' WHERE key = 'api_rate_limit_per_minute' AND value = '100';
