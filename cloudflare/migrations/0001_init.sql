-- CloudGather initial schema (Cloudflare D1 / SQLite).
--
-- Design notes
--  * Every timestamp is an ISO-8601 UTC string so JavaScript parses it without
--    ambiguity (`datetime('now')` would produce a local-looking string).
--  * Files and folders share one table; the folder tree is expressed with
--    `parent_id` plus a materialised `path` for fast breadcrumbs and search.
--  * A folder cannot hold two live items with the same name — enforced by a
--    partial unique index that ignores trashed rows.
--  * Provider OAuth tokens and third-party secrets are AES-GCM encrypted with
--    `TOKEN_ENCRYPTION_KEY` before they reach the database.

CREATE TABLE users (
  id                    TEXT PRIMARY KEY,
  email                 TEXT NOT NULL,
  email_normalized      TEXT NOT NULL UNIQUE,
  email_verified        INTEGER NOT NULL DEFAULT 0,
  display_name          TEXT,
  avatar_url            TEXT,
  password_hash         TEXT NOT NULL,
  password_salt         TEXT NOT NULL,
  password_iterations   INTEGER NOT NULL DEFAULT 210000,
  password_algo         TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
  role                  TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  storage_quota_bytes   INTEGER NOT NULL DEFAULT 53687091200,
  settings              TEXT NOT NULL DEFAULT '{}',
  last_login_at         TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TEXT,
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_created ON users (created_at DESC);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  ip           TEXT,
  user_agent   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT
);
CREATE INDEX idx_sessions_user ON sessions (user_id, expires_at DESC);
CREATE INDEX idx_sessions_expiry ON sessions (expires_at);

-- Single-use tokens for password reset, e-mail verification and share unlocks.
CREATE TABLE tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('password_reset', 'email_verify')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_tokens_user_purpose ON tokens (user_id, purpose);

CREATE TABLE providers (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  provider_name    TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  account_email    TEXT,
  account_label    TEXT,
  total_space      INTEGER,
  used_space       INTEGER,
  priority         INTEGER NOT NULL DEFAULT 0,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TEXT,
  scope            TEXT,
  metadata         TEXT NOT NULL DEFAULT '{}',
  last_synced_at   TEXT,
  last_error       TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_providers_user_name ON providers (user_id, provider_name);
CREATE INDEX idx_providers_status ON providers (status, token_expires_at);

CREATE TABLE files (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  parent_id        TEXT REFERENCES files (id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  path             TEXT NOT NULL DEFAULT '/',
  size             INTEGER NOT NULL DEFAULT 0,
  mime_type        TEXT,
  is_folder        INTEGER NOT NULL DEFAULT 0,
  provider_id      TEXT REFERENCES providers (id) ON DELETE SET NULL,
  provider_file_id TEXT,
  storage_key      TEXT,
  checksum         TEXT,
  starred          INTEGER NOT NULL DEFAULT 0,
  share_count      INTEGER NOT NULL DEFAULT 0,
  trashed_at       TEXT,
  last_accessed_at TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE UNIQUE INDEX idx_files_unique_name ON files (user_id, COALESCE(parent_id, ''), name) WHERE trashed_at IS NULL;
CREATE INDEX idx_files_parent ON files (user_id, parent_id, is_folder DESC, name);
CREATE INDEX idx_files_trash ON files (user_id, trashed_at);
CREATE INDEX idx_files_starred ON files (user_id, starred);
CREATE INDEX idx_files_path ON files (user_id, path);
CREATE INDEX idx_files_provider ON files (provider_id, provider_file_id);
CREATE INDEX idx_files_updated ON files (user_id, updated_at DESC);

CREATE TABLE shares (
  id                TEXT PRIMARY KEY,
  file_id           TEXT NOT NULL REFERENCES files (id) ON DELETE CASCADE,
  owner_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token             TEXT NOT NULL UNIQUE,
  recipient_email   TEXT,
  recipient_user_id TEXT REFERENCES users (id) ON DELETE CASCADE,
  permission        TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  password_hash     TEXT,
  expires_at        TEXT,
  max_downloads     INTEGER,
  download_count    INTEGER NOT NULL DEFAULT 0,
  view_count        INTEGER NOT NULL DEFAULT 0,
  last_accessed_at  TEXT,
  revoked_at        TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_shares_file ON shares (file_id, created_at DESC);
CREATE INDEX idx_shares_owner ON shares (owner_id, created_at DESC);
CREATE INDEX idx_shares_recipient ON shares (recipient_user_id, created_at DESC);
CREATE INDEX idx_shares_token ON shares (token);

CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   TEXT NOT NULL,
  permissions  TEXT NOT NULL DEFAULT '["read"]',
  request_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  expires_at   TEXT,
  revoked_at   TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_api_keys_user ON api_keys (user_id, revoked_at);

CREATE TABLE audit_logs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_email   TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  details       TEXT NOT NULL DEFAULT '{}',
  ip            TEXT,
  user_agent    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  link       TEXT,
  read_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (user_id, read_at);

CREATE TABLE system_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE provider_configs (
  provider_name   TEXT PRIMARY KEY,
  display_name    TEXT NOT NULL,
  auth_type       TEXT NOT NULL CHECK (auth_type IN ('oauth', 'credentials', 'managed')),
  client_id       TEXT,
  client_secret   TEXT,
  scopes          TEXT,
  authorize_url   TEXT,
  token_url        TEXT,
  is_enabled      INTEGER NOT NULL DEFAULT 1,
  is_configured   INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE blog_posts (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  excerpt      TEXT,
  content_md   TEXT NOT NULL,
  cover_image  TEXT,
  tags         TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  author       TEXT NOT NULL DEFAULT 'CloudGather Team',
  read_minutes INTEGER NOT NULL DEFAULT 4,
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_blog_status ON blog_posts (status, published_at DESC);

CREATE TABLE contact_messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
  ip         TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_contact_status ON contact_messages (status, created_at DESC);

-- Rolled-up counters so admin analytics never scans the audit log.
CREATE TABLE usage_daily (
  day              TEXT NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  uploads          INTEGER NOT NULL DEFAULT 0,
  downloads        INTEGER NOT NULL DEFAULT 0,
  deletes          INTEGER NOT NULL DEFAULT 0,
  shares_created   INTEGER NOT NULL DEFAULT 0,
  api_calls        INTEGER NOT NULL DEFAULT 0,
  bytes_uploaded   INTEGER NOT NULL DEFAULT 0,
  bytes_downloaded INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, user_id)
);
CREATE INDEX idx_usage_day ON usage_daily (day DESC);

-- Fixed-window rate limiting. Strongly consistent, unlike KV.
CREATE TABLE rate_limits (
  key          TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL,
  expires_at   TEXT NOT NULL
);
CREATE INDEX idx_rate_limits_expiry ON rate_limits (expires_at);
