# Reconstruction Plan — CloudGather (session `arena/01a0bb52-cloud-gather-front`)

## Product reconstruction (evidence-based)

**What it is:** CloudGather — a multi-cloud storage aggregator SaaS. Users connect the cloud
drives they already pay for (Google Drive, Dropbox, OneDrive, Box, S3-compatible, …) and get one
unified, searchable pool: browse, upload, organise, share and audit everything from one place.
CloudGather is a *management layer*, not a migration tool.

**Users:** individuals with storage sprawl; small teams sharing assets; developers who automate
file operations through an API.

**Category:** SaaS productivity / cloud storage management (primary), developer platform (secondary).

**Evidence:** `README.md`, marketing pages, `files`/`storage_providers`/`file_shares`/`api_keys`
schema, provider OAuth functions, `/api/v1` developer API, admin console, quota settings.

## Target architecture (per mission brief)

```
Users → Vercel (Vite SPA) → /api/* rewrite → Cloudflare Worker (API)
                                              ├── D1   (relational data)
                                              ├── R2   (file objects)
                                              ├── KV   (session cache, rate limits, flags)
                                              ├── Queues (email, activity, provider sync)
                                              └── Cron (retention, cleanup, token refresh)
```

Same-origin `/api` in every environment (Vite proxy in dev, Vercel rewrite in prod) → httpOnly
SameSite=Lax session cookies, no CORS surface, no token in JS reach.

**Durable Objects:** not used — no genuine stateful-coordination requirement was found
(no realtime collaboration, no per-room websockets). Adding one would be complexity without need.

## Workstreams

| # | Workstream | Status |
| - | --- | --- |
| 1 | Cloudflare Worker API (auth, files, shares, providers, keys, admin, public API) | in progress |
| 2 | D1 schema + migrations + seed | in progress |
| 3 | Frontend rewire: Supabase → Worker API (`src/lib/api.ts`) | planned |
| 4 | Design system + cinematic landing/app redesign | planned |
| 5 | SEO (dynamic sitemap, metadata, structured data, robots) | planned |
| 6 | Tests (vitest unit + real end-to-end against workerd) | planned |
| 7 | Docs (README, ARCHITECTURE, DEPLOYMENT, API, SECURITY, RUNBOOK) | planned |

## Honest state tracking

Every deliverable is marked **Implemented**, **Verified**, **Environment-dependent**, **Blocked**
or **Not verified**. No feature is claimed complete while mocked or unverified.
