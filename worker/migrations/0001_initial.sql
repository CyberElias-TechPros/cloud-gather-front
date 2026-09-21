PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_token ON sessions(token_hash, expires_at);
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_password_resets_token ON password_reset_tokens(token_hash, expires_at);

CREATE TABLE files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0 CHECK(size >= 0),
  mime_type TEXT,
  is_folder INTEGER NOT NULL DEFAULT 0 CHECK(is_folder IN (0,1)),
  is_starred INTEGER NOT NULL DEFAULT 0 CHECK(is_starred IN (0,1)),
  is_shared INTEGER NOT NULL DEFAULT 0 CHECK(is_shared IN (0,1)),
  parent_folder_id TEXT REFERENCES files(id) ON DELETE CASCADE,
  provider_id TEXT REFERENCES storage_providers(id) ON DELETE SET NULL,
  provider_file_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX files_unique_name ON files(user_id, COALESCE(parent_folder_id,''), filename);
CREATE INDEX idx_files_listing ON files(user_id, parent_folder_id, updated_at DESC);
CREATE INDEX idx_files_path ON files(user_id, path);

CREATE TABLE storage_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  provider_user_email TEXT,
  status TEXT NOT NULL DEFAULT 'connected' CHECK(status IN ('connected','error','syncing')),
  total_space INTEGER NOT NULL DEFAULT 0,
  used_space INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  encrypted_credentials TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider_name)
);
CREATE INDEX idx_providers_user ON storage_providers(user_id, priority);

CREATE TABLE file_shares (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL COLLATE NOCASE,
  permission_level TEXT NOT NULL DEFAULT 'view' CHECK(permission_level IN ('view','edit')),
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_shares_owner ON file_shares(owner_id, created_at DESC);

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  permissions TEXT NOT NULL DEFAULT '["read"]',
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  request_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_user_created ON audit_logs(user_id, created_at DESC);

CREATE TABLE blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'CloudGather Team',
  category TEXT NOT NULL DEFAULT 'Product',
  tags TEXT NOT NULL DEFAULT '[]',
  image TEXT,
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO system_settings(key,value) VALUES
 ('app_name','"CloudGather"'),('maintenance_mode','false'),('registration_enabled','true'),
 ('max_file_size_mb','100'),('max_storage_per_user_gb','10'),('api_rate_limit_per_minute','100'),
 ('password_min_length','10'),('audit_logging_enabled','true');
