# CloudGather

**One home for every cloud.** CloudGather connects the cloud storage accounts you already
use — Google Drive, Dropbox, OneDrive, Box, S3-compatible buckets and more — and lets you
browse, search, organize and share everything from a single dashboard. Your files stay
with their original providers; CloudGather is a management layer, not a migration tool.

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS (shadcn-style components), deployed on **Vercel**
- **Backend:** Supabase — Postgres + Auth + Storage + Row-Level Security, plus **Deno Edge Functions**
- **Tests:** Vitest + Testing Library (`npm test`)

---

## Quick start

```bash
git clone <repository-url> cloudgather && cd cloudgather
npm install
cp .env.example .env   # then fill in your Supabase project values
npm run dev            # http://localhost:8080
```

Environment variables (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable ("anon") key — safe for the browser |
| `VITE_PUBLIC_SITE_URL` | Public origin, used for canonical URLs / OAuth redirects |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server on port 8080 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit & component tests (Vitest) |
| `npm run typecheck` | `tsc -b` strict project check |
| `npm run lint` | ESLint |

## Project structure

```
├── public/                 # static assets: icons, og-image, robots.txt, sitemap.xml
├── src/
│   ├── components/         # brand, layout, admin, files UI, shadcn-style ui/
│   ├── contexts/           # AuthContext (Supabase session + profile + admin RPC)
│   ├── lib/                # site config, formatting, SEO builders, provider catalog
│   ├── pages/              # marketing pages (SEO'd) + app pages (authed)
│   ├── services/           # data-access layer (files.ts) — all DB calls live here
│   └── test/               # Vitest setup
├── supabase/
│   ├── migrations/         # SQL migrations (latest: 20260907000000_productionize.sql)
│   └── functions/          # Deno edge functions (API, API keys, OAuth, delete-account)
├── vercel.json             # SPA rewrites, caching, security headers
└── docs/                   # architecture, deployment & security notes
```

## Feature map

**Public (SEO-targeted):** landing page with FAQ structured data, features, pricing,
developers/API docs, blog (posts authored in the admin console, stored in `blog_posts`),
about, contact, privacy, terms. Correct canonicals, OG/Twitter metadata, `sitemap.xml`,
`robots.txt` that excludes all authenticated areas.

**App (authenticated):**
- **Dashboard** — usage stats, pooled-quota bar, recent activity (audit log), connected providers
- **Files** — folder tree, upload with real progress (drag & drop), rename, delete (recursive),
  star, download, list/grid views, sorting, search, bulk select
- **Recents** — most recently modified files, grouped by day
- **Storage** — usage by provider and by file type, quota warnings
- **Providers** — connect/disconnect storage providers, pool ordering
- **API keys** — create (shown once, stored hashed) and revoke personal API keys
- **Settings** — profile, password change, theme & preferences (persisted to `profiles.settings`),
  JSON data export, full account deletion
- **Admin console** — platform stats, user list, admin management, system settings
  (all server-side gated by `is_admin_user()` + RLS)

## Backend

The API surface lives in `supabase/functions` (Deno). Key functions:

| Function | Purpose |
| --- | --- |
| `storage-api` | The public REST API (`/api/v1/...`) authenticated with `x-api-key` personal keys |
| `api-key-management` | Create/list/revoke API keys (keys stored as SHA-256 hashes, shown once) |
| `delete-account` | Full account + data deletion cascade (JWT-verified) |
| `google-drive-auth` | Reference OAuth connect flow (start + callback, CSRF state) |
| `<provider>-auth` | Per-provider OAuth scaffolds following the same pattern |
| `list-files`, `list-provider-files` | Metadata listing for connected providers |
| `sync-auth` | Credential-based provider connections |

See **`supabase/README.md`** for per-function status, required secrets, and the deployment
prerequisites (OAuth credentials per provider are operator-supplied).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, data model, security model
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Vercel + Supabase setup, step by step
- [`docs/SECURITY.md`](docs/SECURITY.md) — security audit summary and responsible-disclosure contact
- [`supabase/README.md`](supabase/README.md) — migrations and edge-function operations

## License

All rights reserved. Provider names (Google Drive, Dropbox, OneDrive, Box, …) are
trademarks of their respective owners; CloudGather is not affiliated with them.
