# Gap analysis — what was missing, and what now exists

This is the audit that drove the two implementation commits. Each row records
what the repository actually did before the work, and what it does now. "Was"
statements describe the code at `b06a4d6`.

---

## 1. Backend / API

| Area | Was | Now |
| --- | --- | --- |
| API surface | Partial Worker with a handful of routes; the frontend called endpoints that did not exist | 136 routes across 16 modules, all declared with auth/scope/rate-limit metadata |
| Schema | Incomplete; no seed | `0001_initial` → `0002_platform` → `0003_seed` (idempotent: 23 settings, 6 posts, welcome announcement) |
| Sessions | Token stored, never pruned or enumerable | Hashed tokens, listable/revocable sessions, "sign out everywhere", cron pruning |
| Two-factor auth | Absent | TOTP enrolment with QR + recovery codes, disable with password re-auth |
| Email | No transport | Provider abstraction (Resend/Postmark/SendGrid) with a durable `email_outbox`, retries and an admin flush |
| Password reset / verification | Incomplete | Single-use hashed tokens, one-hour expiry, full request → email → confirm flow |
| Social sign-in | Absent | Google, GitHub, Microsoft with state validation and identity linking/unlinking |
| Storage providers | Stubs | 9 adapters behind one interface (Drive, Dropbox, OneDrive, Box, S3, Backblaze, S3-compatible, …) with encrypted credentials and token refresh |
| Sharing | Basic | Per-person shares plus public links with expiry, download caps, password hashing and visit logging |
| Trash / versions | Absent | Trash with per-plan retention, restore, purge, and version history with restore |
| API keys | Absent | Hashed keys, read/write/share scopes, prefixes, rotation, usage tracking, per-plan rate limits |
| Webhooks | Absent | Endpoints, event catalogue, HMAC-SHA256 signatures, delivery log, retries, ping test |
| Billing | Absent | Plan catalogue, Stripe checkout/portal, signed webhook receiver, invoices, entitlement enforcement |
| Notifications | Absent | In-app notifications, unread counts, per-channel preferences, digests |
| Audit log | Absent | Append-only activity log with severity, actor, IP and admin filtering |
| Admin API | Two endpoints | Stats, users, settings, audit, contact, blog, announcements, newsletter, storage report, outbox, cron runner |
| Rate limiting | Absent | KV-backed limits on auth, uploads, link access, contact and the public API, with `Retry-After` |
| Scheduled work | Absent | Three cron triggers: 5-minute (email/tokens/webhook retries), daily (trash/sessions/accounts), weekly (digests) |
| Machine-readable docs | Absent | `/api/openapi.json` generated from the router, so docs cannot drift |

## 2. Frontend — data and flows

| Area | Was | Now |
| --- | --- | --- |
| Files | Read-only listing | Upload (drag/drop, folders, progress), create/rename/move/copy/star/trash/restore/delete, bulk actions, preview, details sheet, version history |
| Search | Local filter | Server search across CloudGather + connected providers, with type/status filters and **saved searches** |
| Providers | Static cards | Live connection state, OAuth connect, credential forms for S3-compatible backends, browse, sync, disconnect, reorder, honest "not configured" states |
| Storage | Hardcoded numbers | Real usage by category and provider, quota, trash size, plan limits |
| Settings | Placeholder | Profile + avatar, preferences (theme/locale/timezone/marketing), security (password, 2FA, sessions, identities), data & privacy (export, delete, cancel deletion) |
| API keys | Absent | Create with scopes and expiry, one-time reveal, rotate, revoke, usage |
| Webhooks | Absent | Endpoints, event selection, signing secret, delivery history, test ping |
| Billing | Absent | Subscription state, plan switching, Stripe portal, invoices, usage against limits |
| Notifications | Absent | List, mark read, preferences |
| Contact | `mailto:` link only | Real `POST /api/contact` with validation, topics from config, optional Turnstile, reference id |
| Newsletter | Endpoint existed, no UI | Footer signup form; `/unsubscribe` already existed |
| Pricing | Hardcoded "TBA" beta table | Live plan catalogue from `/api/config`, monthly/yearly toggle, limits comparison, checkout routing |
| Developers | Seven hand-written endpoints, several wrong | Reference generated live from `/api/openapi.json`, plus verified cURL/Node/Python examples |
| Admin console | Three thin panels | Eight panels: overview, users, inbox, blog, announcements, operations, audit log, settings |

## 3. Cross-cutting

| Area | Was | Now |
| --- | --- | --- |
| Type accuracy | `Plan` and `Paged<T>` did not match the worker — prices and pagination would have rendered `undefined` | Both mirror the worker payloads; verified against the running API |
| Capability handling | UI showed controls for unconfigured integrations | `/api/config` capability map hides or explains every unconfigured flow |
| Error handling | Mixed | Typed `ApiError`, one message helper, error boundary, empty states, explicit error cards |
| Security headers | CSP blocked Stripe and Turnstile | CSP widened for exactly those two, plus `worker-src`/`media-src` for blob previews |
| Dev environment | Browser had to call `localhost:8787` directly | Vite proxies `/api` to the Worker; the app uses a same-origin relative URL |
| Secrets | Undocumented | `.dev.vars.example` documents every key, what it enables and the external setup it needs |
| Docs | Thin | README + architecture, deployment runbook (ordered, with cron schedule and a 13-step first-run checklist) and security posture |
| Tests | 43 | 69, including render coverage for pricing, newsletter and the admin dashboard |
| SEO | Missing routes | `robots.txt` covers every authenticated route and public-link paths; `/status` added to the sitemap |

---

## 4. What is deliberately *not* in the code

These are the only things left, and all of them are credentials or external
console configuration — no code changes are required for any of them.

1. `ENCRYPTION_KEY` — `openssl rand -base64 32`.
2. An email provider key (`RESEND_API_KEY` / `POSTMARK_TOKEN` / `SENDGRID_API_KEY`) plus a verified `FROM_EMAIL`.
3. Social OAuth apps: Google, GitHub, Microsoft client IDs/secrets.
4. Storage provider OAuth apps: Google Drive, Dropbox, OneDrive, Box.
5. Stripe secret key, webhook signing secret and the four price IDs.
6. Cloudflare Turnstile site + secret keys.
7. Cloudflare resource IDs in `wrangler.toml` (D1, R2, KV) and the Vercel env vars.

Every one of them is listed in `.dev.vars.example` with its purpose, and every
associated feature degrades honestly while the key is absent.

## 5. Verification performed

- `npm run typecheck`, `npm run cf:typecheck`, `npm run lint` (0 errors), `npm test` (69 passing), `npm run build`.
- Live end-to-end runs against `wrangler dev` through the Vite proxy: register,
  login, password reset, folder create, upload, download, public link, trash and
  restore, API key creation and scoped use (`200` for read, `403` for write),
  webhook plan gating (`403` on Free), contact submission, newsletter signup,
  data export, account deletion and cancellation, saved searches.
- Every path called by `src/services/*` was diffed against the generated
  OpenAPI document: no orphaned frontend calls.
