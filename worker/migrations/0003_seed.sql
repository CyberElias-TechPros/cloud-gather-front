-- 0003_seed.sql — default settings rows and launch blog content.
-- Idempotent: safe to re-run. Uses INSERT OR IGNORE keyed on unique columns.

/* ------------------------------------------------- system settings */
INSERT OR IGNORE INTO system_settings(key, value) VALUES
  ('app_name', '"CloudGather"'),
  ('maintenance_mode', 'false'),
  ('maintenance_message', '"CloudGather is undergoing scheduled maintenance. We will be back shortly."'),
  ('registration_enabled', 'true'),
  ('require_email_verification', 'false'),
  ('max_file_size_mb', '100'),
  ('max_storage_per_user_gb', '10'),
  ('api_rate_limit_per_minute', '120'),
  ('password_min_length', '10'),
  ('password_require_mixed_case', 'false'),
  ('password_require_number', 'false'),
  ('password_require_symbol', 'false'),
  ('audit_logging_enabled', 'true'),
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

/* ------------------------------------------------------ blog content */
INSERT OR IGNORE INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at, reading_minutes, seo_title, seo_description, featured, created_at, updated_at) VALUES(
  'seed-introducing-cloudgather',
  'introducing-cloudgather',
  'Introducing CloudGather: every cloud, one window',
  'Your files already live in five different clouds. CloudGather gives them a single, fast, searchable home without moving a byte you do not want moved.',
  '## The problem with "just use one cloud"

Nobody chooses to scatter their work across Google Drive, Dropbox, OneDrive and an S3 bucket. It happens: a client shares a folder, a team standardises on something else, an old laptop backed up somewhere you have since forgotten.

CloudGather is the layer on top. Connect an account and its contents appear alongside everything else — same list, same search box, same share dialog.

## What "connected" actually means

We do not copy your files by default. A connected provider is indexed, not duplicated:

- **Browse** folders live, straight from the provider API.
- **Search** across every provider at once using the local index.
- **Import** a file into CloudGather-managed storage only when you explicitly ask.
- **Export** back out to any connected provider whenever you want.

That distinction matters for both your storage bill and your privacy posture.

## Built on the edge

The API runs on Cloudflare Workers, the database is D1, and managed files live in R2. Requests are handled in the data centre closest to you, so listing a folder from Sydney feels the same as listing it from Frankfurt.

## Getting started

1. Create an account and verify your email.
2. Connect your first provider from **Providers → Connect**.
3. Drag a file into the dashboard, or import one you already have.

That is the whole onboarding. No agent to install, no sync daemon eating your battery.',
  'CloudGather Team',
  'Product',
  '["announcement", "product"]',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
  1,
  datetime('now', '-42 days'),
  5,
  'Introducing CloudGather: every cloud, one window | CloudGather',
  'Your files already live in five different clouds. CloudGather gives them a single, fast, searchable home without moving a byte you do not want moved.',
  1,
  datetime('now', '-42 days'),
  datetime('now', '-42 days')
);

INSERT OR IGNORE INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at, reading_minutes, seo_title, seo_description, featured, created_at, updated_at) VALUES(
  'seed-how-we-keep-your-files-safe',
  'how-we-keep-your-files-safe',
  'How CloudGather keeps your files safe',
  'Credential encryption, hashed tokens, scoped API keys and an audit trail you can export. A plain-English tour of the security model.',
  '## Credentials are encrypted, not stored

Provider access tokens and refresh tokens are encrypted with AES-GCM using a key held as a Worker secret. The ciphertext in the database is useless without it. If the key is not configured, CloudGather refuses to accept credentials at all rather than storing them in the clear.

## Passwords

Passwords are hashed with PBKDF2-SHA-256 at 210,000 iterations with a per-user random salt — the current OWASP guidance for PBKDF2. We never log them, never email them, and a reset link can only be used once.

## Sessions and API keys

Session tokens and API keys are stored as SHA-256 hashes. A database dump does not give an attacker a working credential. Every session records the device, approximate location and last activity so you can spot and revoke anything unfamiliar from **Settings → Security**.

API keys are scoped: `read`, `write`, `share` or `admin`. A key that only needs to list files should never be able to delete them.

## Two-factor authentication

TOTP-based 2FA works with any authenticator app. Enabling it generates ten single-use recovery codes. Logging in becomes a two-step exchange: password first, then a short-lived challenge that expires in ten minutes.

## The audit trail

Every meaningful action — sign-in, share, permission change, deletion — is written to an audit log with severity, IP and user agent. You can export the whole thing, along with all your data, from **Settings → Data**.

## Deletion means deletion

Deleted files sit in trash for a retention window you can see and change. After that a scheduled job removes the object from storage and the row from the database. Deleting your account schedules a full purge — objects, rows, sessions, tokens — after a 30-day grace period during which you can change your mind.',
  'CloudGather Team',
  'Security',
  '["security", "encryption", "privacy"]',
  'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80',
  1,
  datetime('now', '-31 days'),
  7,
  'How CloudGather keeps your files safe | CloudGather',
  'Credential encryption, hashed tokens, scoped API keys and an audit trail you can export. A plain-English tour of the security model.',
  1,
  datetime('now', '-31 days'),
  datetime('now', '-31 days')
);

INSERT OR IGNORE INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at, reading_minutes, seo_title, seo_description, featured, created_at, updated_at) VALUES(
  'seed-public-links-done-properly',
  'public-links-done-properly',
  'Public links, done properly',
  'Expiring links, password protection, download caps and per-visit analytics — how to share a file with someone who does not have an account.',
  '## One file, one URL, zero accounts

Open any file, choose **Share → Create link**, and you get a URL of the form `/s/<token>`. The recipient needs nothing but a browser.

## The controls that matter

- **Expiry** — links can self-destruct on a date you pick.
- **Password** — protected links exchange the password for a short-lived access token; the password itself is hashed, never stored.
- **Download limit** — cap the number of downloads and the link retires itself.
- **Revocation** — one click kills the link immediately, even if it is already in someone''s inbox.

## Know what happened

Every visit records a timestamp, coarse location and a hashed IP — enough to answer "did they open it?" without building a surveillance product. You can see the full visit list from the link''s detail panel.

## A note on tokens

Link tokens are generated from 18 random bytes and stored hashed, exactly like session tokens. We show you the full URL once, at creation. If you lose it, rotate the link rather than hunting for it.',
  'CloudGather Team',
  'Product',
  '["sharing", "links", "howto"]',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
  1,
  datetime('now', '-24 days'),
  4,
  'Public links, done properly | CloudGather',
  'Expiring links, password protection, download caps and per-visit analytics — how to share a file with someone who does not have an account.',
  0,
  datetime('now', '-24 days'),
  datetime('now', '-24 days')
);

INSERT OR IGNORE INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at, reading_minutes, seo_title, seo_description, featured, created_at, updated_at) VALUES(
  'seed-bring-your-own-s3',
  'bring-your-own-s3',
  'Bring your own S3 (or Backblaze, or anything compatible)',
  'Point CloudGather at a bucket you already pay for. Signed requests, no data leaving your account, and the same UI as everything else.',
  '## Why S3 support looks different

OAuth providers hand us a token. S3-compatible storage hands us a key pair, which means CloudGather has to sign every request itself using AWS Signature Version 4. We implement SigV4 directly against the Web Crypto API — no SDK, no Node polyfills, nothing to keep patched.

## What you need

- Access key ID and secret access key
- Bucket name
- Region (default `us-east-1`)
- Endpoint, if you are not on AWS — Backblaze B2, Cloudflare R2, Wasabi, MinIO and friends all work

Path-style addressing is enabled automatically for custom endpoints, which is what most non-AWS providers expect.

## Least privilege

Create a dedicated key with access to a single bucket. CloudGather needs `ListBucket`, `GetObject`, `PutObject` and `DeleteObject` on that bucket and nothing else.

## What happens to your data

Nothing moves. Browsing lists objects through the S3 API; downloading streams straight through. If you import a file into managed storage, that is an explicit action and we tell you how much of your quota it consumes.',
  'CloudGather Team',
  'Engineering',
  '["s3", "backblaze", "storage"]',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
  1,
  datetime('now', '-17 days'),
  6,
  'Bring your own S3 (or Backblaze, or anything compatible) | CloudGather',
  'Point CloudGather at a bucket you already pay for. Signed requests, no data leaving your account, and the same UI as everything else.',
  0,
  datetime('now', '-17 days'),
  datetime('now', '-17 days')
);

INSERT OR IGNORE INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at, reading_minutes, seo_title, seo_description, featured, created_at, updated_at) VALUES(
  'seed-webhooks-and-the-api',
  'webhooks-and-the-api',
  'Automate CloudGather with the API and webhooks',
  'Scoped API keys, an OpenAPI document and signed webhook deliveries with automatic retries. Everything you need to wire CloudGather into your own systems.',
  '## The API

Every action in the web app is a documented HTTP endpoint. Fetch the machine-readable contract from `/api/openapi.json` and point your favourite generator at it.

Authenticate with a personal API key:

```
curl https://api.example.com/api/files \
  -H "X-API-Key: cg_live_xxxxxxxxxxxx"
```

Keys carry scopes (`read`, `write`, `share`, `admin`), can expire on a date you choose, and can be rotated without downtime — the old secret stops working the moment the new one is issued.

## Webhooks

Register an endpoint, pick the events you care about, and CloudGather POSTs a JSON payload when they happen: uploads, deletions, shares, link visits, provider errors, billing changes.

Each delivery carries a signature header:

```
X-CloudGather-Signature: t=1716470000,v1=<hex hmac>
```

Recompute the HMAC-SHA256 of `"{timestamp}.{body}"` with your endpoint secret and compare. Reject anything older than five minutes.

## Retries you do not have to think about

Failed deliveries are retried with exponential backoff — 2, 4, 8, 16 minutes and so on, capped at six hours, for six attempts. Persistent failures disable the endpoint and notify you rather than silently hammering a dead URL.',
  'CloudGather Team',
  'Engineering',
  '["api", "webhooks", "automation"]',
  'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=80',
  1,
  datetime('now', '-10 days'),
  6,
  'Automate CloudGather with the API and webhooks | CloudGather',
  'Scoped API keys, an OpenAPI document and signed webhook deliveries with automatic retries. Everything you need to wire CloudGather into your own systems.',
  0,
  datetime('now', '-10 days'),
  datetime('now', '-10 days')
);

INSERT OR IGNORE INTO blog_posts(id, slug, title, excerpt, content, author, category, tags, image, published, published_at, reading_minutes, seo_title, seo_description, featured, created_at, updated_at) VALUES(
  'seed-storage-quotas-explained',
  'storage-quotas-explained',
  'Storage quotas, explained without the asterisks',
  'What counts against your quota, what does not, and how trash, versions and connected providers are billed.',
  '## The short version

Only files stored **in** CloudGather count against your quota. Files that live in a connected provider are indexed, not stored, and cost you nothing.

## What counts

- Files you upload directly
- Files you import from a provider with the "copy into CloudGather" option
- Historical versions retained by version history
- Items in trash, until they are purged

Trash is included deliberately: it is real storage until it is really gone. The dashboard shows trash separately so you always know how much you would reclaim by emptying it.

## What does not count

- Anything browsed live from Google Drive, Dropbox, OneDrive, Box, S3 or Yandex
- Thumbnails and metadata
- Shares and public links

## When you get close

At 85% we show a banner. At 90% we email you once a week, not once an hour. At 100% uploads stop, but nothing is deleted and nothing is held hostage — downloads, shares and exports keep working so you can always get your data out.',
  'CloudGather Team',
  'Product',
  '["billing", "storage", "plans"]',
  'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
  1,
  datetime('now', '-4 days'),
  4,
  'Storage quotas, explained without the asterisks | CloudGather',
  'What counts against your quota, what does not, and how trash, versions and connected providers are billed.',
  0,
  datetime('now', '-4 days'),
  datetime('now', '-4 days')
);

/* --------------------------------------------------- launch notice */
INSERT OR IGNORE INTO announcements(id, title, body, level, audience, published, starts_at) VALUES(
  'seed-welcome',
  'Welcome to CloudGather',
  'Connect your first cloud provider to see all of your files in one place.',
  'info',
  'all',
  0,
  NULL
);
