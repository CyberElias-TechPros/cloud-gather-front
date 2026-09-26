# Architecture

CloudGather is a React/Vite SPA deployed to Vercel plus a Cloudflare Worker API
backed by D1, private R2 storage and KV.

```text
Browser ──► Vercel SPA ──HTTPS──► Cloudflare Worker ──► D1 (SQL)
                                          ├──────────► R2 (objects, private)
                                          ├──────────► KV (rate limits, settings cache)
                                          └──────────► Provider APIs (Drive, Dropbox, OneDrive, Box, S3…)
```

## Worker layout

| Path | Responsibility |
| --- | --- |
| `worker/src/index.ts` | Router composition, CORS, security headers, `/api/openapi.json`, cron entrypoint |
| `worker/src/env.ts` | Typed bindings plus the `capabilities()` map published at `/api/config` |
| `worker/src/core/*` | Cross-cutting primitives: auth, sessions, crypto, rate limiting, email, validation, audit, notifications, responses |
| `worker/src/routes/*` | One module per resource: system, auth, social, profile, uploads, shares, providers, files, api-keys, webhooks, notifications, activity, billing, contact, blog, admin |
| `worker/src/providers/*` | One adapter per storage backend behind a shared interface |
| `worker/src/billing/*` | Plan catalogue and the Stripe integration |
| `worker/src/cron/scheduled.ts` | Outbox flush, token refresh, webhook retries, trash/session purges, weekly digests |
| `worker/migrations/*.sql` | Ordered, idempotent schema + seed migrations |

Routes declare their own metadata (`auth`, `admin`, `rateLimit`, `summary`), so
the OpenAPI document and the Developers page reference are generated from the
router itself and cannot drift from the implementation.

## Frontend layout

| Path | Responsibility |
| --- | --- |
| `src/lib/api.ts` | Fetch wrapper: base URL, auth header, typed errors, upload progress, downloads, a global signed-out event |
| `src/services/*` | One typed module per API area — components never call `fetch` directly |
| `src/contexts/AuthContext.tsx` | Session bootstrap, sign-in/out, refresh, capability-aware user state |
| `src/hooks/useAppConfig.ts` | Cached `/api/config` — drives feature flags, plans, policies and the Turnstile site key |
| `src/components/{layout,common,files,auth,admin,…}` | Shared shells and feature components |
| `src/pages/*` | One page per route; `src/App.tsx` owns the router and lazy-loads public pages |

## Data and trust boundaries

- The browser holds an opaque session token; D1 stores only its SHA-256 hash.
- The Worker is the sole database and object-storage boundary. Every private
  query is scoped to the authenticated user; admin routes re-check the role
  server-side, so the client-side `AdminRoute` is convenience only.
- D1 holds users, sessions, files, provider connections, shares, API keys,
  webhooks, notifications, audit events, blog posts, tickets and settings.
- R2 stores bytes under user-prefixed keys with no public bucket URL; downloads
  are streamed through an authenticated endpoint.
- Passwords use PBKDF2-SHA-256 with 210,000 iterations and per-user salts.
- Provider credentials and TOTP secrets are encrypted at rest with
  `ENCRYPTION_KEY` (AES-GCM) and never enter the frontend bundle.
- Personal API keys carry `read`, `write` and `share` permissions and are stored
  hashed.

## Capability-driven UI

`/api/config` publishes a non-secret capability map plus the plan catalogue,
password policy and limits. Unconfigured integrations report `false`, and the UI
hides or explains the affected flow rather than showing a control that fails.
