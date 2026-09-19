# CloudGather API (Cloudflare Workers)

The backend for CloudGather: a multi-cloud storage aggregator. It runs on
Cloudflare Workers with **D1** (metadata), **R2** (file bytes), **KV** (settings
cache, storage-warning throttles, maintenance locks), **Queues** (e-mail and
drive imports) and **Cron Triggers** (housekeeping).

```
cloudflare/
├── migrations/          D1 schema + seeded settings, providers and articles
├── scripts/gen-seed.py  regenerates 0002_seed.sql (never hand-edit that file)
├── src/
│   ├── index.ts         entry: fetch / scheduled / queue
│   ├── lib/             crypto, auth, files, providers, rate limits, e-mail, ZIP
│   └── routes/          auth, files, shares, providers, keys, admin, public, notifications
└── tests/unit/          pure-logic tests (crypto, routing, SigV4, ZIP, naming)
```

## Local development

```bash
cp cloudflare/.dev.vars.example cloudflare/.dev.vars   # fill in the secrets
npm run db:migrate:local                               # create the local D1 schema
npm run dev:api                                        # http://127.0.0.1:8787
```

Then, from another terminal:

```bash
npm run api:typecheck   # tsc against the Worker config
npm run api:test        # unit tests
npm run api:smoke       # 115 end-to-end checks against the running Worker
```

`npm run dev` (Vite) proxies `/api` to `127.0.0.1:8787`, so the browser talks to
the Worker on its own origin and the session cookie stays first-party.

### Required secrets

| Variable | Purpose |
| --- | --- |
| `SESSION_SECRET` | signs session cookies, OAuth state and share-unlock tokens |
| `TOKEN_ENCRYPTION_KEY` | AES-256-GCM key that seals provider credentials at rest |
| `ADMIN_EMAIL` | this account is promoted to administrator on first sign-in |
| `RESEND_API_KEY` | optional; without it e-mail is logged instead of delivered |
| `GOOGLE_/DROPBOX_/MICROSOFT_/BOX_CLIENT_ID` + `_SECRET` | optional; enable connecting those drives |

## First-time deployment

```bash
npx wrangler login

npx wrangler d1 create cloudgather
npx wrangler r2 bucket create cloudgather-files
npx wrangler kv namespace create CACHE
npx wrangler queues create cloudgather-jobs
npx wrangler queues create cloudgather-jobs-dlq

# put the returned ids into cloudflare/wrangler.toml (database_id, kv id)
npm run db:migrate:remote

npx wrangler secret put SESSION_SECRET --config cloudflare/wrangler.toml
npx wrangler secret put TOKEN_ENCRYPTION_KEY --config cloudflare/wrangler.toml
npx wrangler secret put ADMIN_EMAIL --config cloudflare/wrangler.toml
npx wrangler secret put RESEND_API_KEY --config cloudflare/wrangler.toml   # optional

npm run deploy:api
```

Point the frontend at it with `VITE_API_BASE` (or the `/api/*` rewrite in
`vercel.json`) and register using the `ADMIN_EMAIL` address to obtain the first
administrator account.

## Notes on the design

- **Bytes live in R2 under `<userId>/<fileId>`** — renaming or moving a file never
  rewrites the object, and permanent deletion knows exactly which keys to remove.
- **D1 is the source of truth for limits.** KV is only ever a cache, so a KV
  outage degrades performance, never correctness.
- **Passwords** are PBKDF2-SHA256 at 210 000 iterations (`PASSWORD_ITERATIONS`
  lowers it for constrained plans; the app rehashes on next sign-in).
- **Provider credentials** are sealed with AES-256-GCM before storage; a database
  dump alone cannot be replayed against a provider.
- **Rate limits** use atomic UPSERTs in D1 — KV's eventual consistency makes it a
  poor fit for authentication throttling.
- **Queues** keep e-mail and drive imports out of the request path; every job is
  idempotent and retries with backoff into a dead-letter queue.
- **Cron** runs a light sweep every 30 minutes and a heavier nightly pass (trash
  retention, storage warnings, audit trimming) under a KV lock so it stays
  single-flight.
