-- Native OAuth handoff: no bearer token ever enters a custom-scheme URL.
-- The app holds a 256-bit verifier; only its S256 challenge is stored here.
CREATE TABLE IF NOT EXISTS mobile_oauth_flows (
  id_hash TEXT PRIMARY KEY,
  challenge TEXT NOT NULL,
  client_state TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT UNIQUE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mobile_oauth_expiry ON mobile_oauth_flows(expires_at);
