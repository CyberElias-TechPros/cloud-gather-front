# Security

## Secrets

- No production secret is committed or exposed to Vite. Only `VITE_API_URL` and
  `VITE_PUBLIC_SITE_URL` reach the browser bundle, and both are public values.
- Every server secret is a Wrangler secret, documented in `.dev.vars.example`.
- `ENCRYPTION_KEY` (AES-GCM, base64 32 bytes) encrypts provider credentials and
  TOTP secrets at rest. Rotating it invalidates those stored values.

## Authentication

- Passwords use PBKDF2-SHA-256, 210,000 iterations, random per-user salts.
- Session tokens, password-reset tokens, email-verification tokens and personal
  API keys are stored only as SHA-256 hashes.
- Reset tokens are single-use and expire after one hour.
- Optional TOTP two-factor auth with single-use recovery codes.
- Sessions are enumerable and individually revocable; "sign out everywhere"
  invalidates all of them server-side.
- Failed sign-ins are rate limited per IP and per account.

## Authorization

- Ownership is enforced in every private Worker query.
- Admin endpoints verify the server-side role on each request; the client-side
  route guard is convenience, not the boundary.
- API keys enforce read/write/share permissions and per-plan rate limits.
- Share links support expiry, download caps and bcrypt-style hashed passwords;
  access attempts are logged.

## Transport and browser hardening

- CORS uses an exact origin allowlist — no wildcards, no origin reflection.
- Responses carry `X-Content-Type-Options: nosniff`, frame denial, a strict
  referrer policy, a restrictive `Permissions-Policy` and a request ID.
- `vercel.json` sets a CSP that allows only self-hosted scripts plus Stripe and
  Turnstile, and forbids framing entirely.
- R2 is private; downloads pass through an authenticated streaming endpoint.

## Abuse prevention and integrity

- KV-backed rate limiting on authentication, uploads, share access, the contact
  form and the public API, returning `429` with `Retry-After`.
- Optional Cloudflare Turnstile on the contact form.
- Outbound webhooks are signed with HMAC-SHA256 and retried with backoff.
- Stripe webhooks verify the signature and reject replays.
- Uploads are capped per plan and validated; D1 constraints enforce relationship
  and naming integrity.
- Security-relevant actions are written to an append-only audit log that admins
  can filter by action, actor and severity.

## Data lifecycle

- Account deletion is a scheduled, cancellable request; after the grace period a
  cron job removes R2 objects before cascading the D1 records.
- Users can export all of their data as JSON at any time.
- Trash is retained per plan and purged automatically.

## Still required at deployment

Cloudflare WAF and rate-limit rules, log drains and alerting, scheduled D1
backups, an R2 lifecycle policy, provider-secret rotation, and email domain
verification (SPF/DKIM/DMARC).
