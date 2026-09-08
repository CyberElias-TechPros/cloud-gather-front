# Security notes

This document summarizes the security review of the codebase and what was changed, plus
guidance for reporting issues.

## Reporting

Email **security@** (via the contact page, subject "Security") for responsible disclosure.
We treat reports as confidential and will credit reporters who wish to be named.

## Audit summary (what was fixed)

### Critical

| Finding | Fix |
| --- | --- |
| `api_keys` stored **plaintext** keys in a `key` column (old schema revision) and one function verified keys with `eq('key', …)`. | Consolidated migration hashes any legacy keys to `key_hash` (SHA-256) and drops the plaintext column. New keys are `cg_`-prefixed, shown once, stored hashed. |
| Every edge function identified the caller with server-side `supabase.auth.getSession()`, which is **always unauthenticated** — effectively no server-side authorization. | Functions now verify the caller's `Authorization` JWT against the auth server (`getUserIdFromJwt`), or verify hashed API keys, and scope every query explicitly by `user_id` with the service-role client. |
| `storage-api` used the anon client, so RLS silently returned **zero rows** — the public API could never work against a secured database. | Rewritten on the service-role client with explicit per-user scoping, permission checks (`read`/`write`/`share`), expiry checks and a per-key rate limit. |
| Audit-log insert policy was `WITH CHECK (true)` — anyone (including anonymous) could forge log entries. | Policy now requires `auth.uid() = user_id`; edge functions use the service role (bypasses RLS by design). |

### High

| Finding | Fix |
| --- | --- |
| Any authenticated user could read the `admin_users` table (enumerate admin identities). | Policy tightened to `is_admin_user()`. |
| Admin status was derived from `profiles.role`, a client-writable column → **privilege escalation**: a user could PATCH their profile role to `admin` (the UI never did, but the endpoint allowed it). | Admin status now comes exclusively from the `is_admin_user()` SECURITY DEFINER RPC backed by `admin_users`; `ProfileUpdates` type restricts client updates to name/avatar/settings; new RLS admin policies keep the console working. |
| Team invitations accepted arbitrary input and were stored only in local component state — a fake feature. | Page removed. `teams`/`team_members` tables remain (RLS-protected) for the roadmap. |
| Disconnected providers merely set `status='disconnected'`, leaving OAuth tokens in the database indefinitely. | Disconnect now deletes the row (tokens destroyed); the Providers page explains the scope. |
| `delete-account` was missing entirely — no way to satisfy deletion requests. | New JWT-verified `delete-account` function performs the full cascade (objects, shares, files, provider tokens, API keys, analytics, profile, auth user, admin entry). |

### Medium

| Finding | Fix |
| --- | --- |
| Share dialogs trusted client state; no expiry validation or duplicate-share handling. | Service layer validates email format and future expiry; unique-share errors surface as friendly 409s. Revocation is explicit. |
| File deletes left orphaned storage objects on partial failures. | Recursive folder delete removes descendant objects before rows; failed DB inserts after upload trigger storage cleanup. |
| Uploads had no client-side size guard (server enforces 100 MB via bucket). | Client and API both validate size and empty files; friendly errors. |
| No rate limiting on the public API. | Fixed-window limiter per key (100/min) with `Retry-After`, plus platform gateway limits. |
| CORS `*` on all functions. | Configurable via `ALLOWED_ORIGIN` secret; documented to pin in production. |

### Low

- Removed the third-party `gptengineer.js` script from `index.html`.
- Security headers (CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) now set via `vercel.json`.
- `robots.txt` disallows all authenticated routes; protected pages emit `noindex`.
- Error messages no longer leak database/internal details to end users; details go to structured console logging.

## Residual risk / operator responsibilities

- Set `ALLOWED_ORIGIN` in production so CORS is not `*`.
- The in-memory OAuth `state` store in `google-drive-auth` is per-isolate; for
  multi-region correctness, move state to a table or KV store (noted in code).
- Provider OAuth functions other than Google remain scaffolds; do not point real users
  at them until they are completed and their secrets configured.
- Session revocation on password change is Supabase-managed; the Security settings page
  explains the behavior honestly.
