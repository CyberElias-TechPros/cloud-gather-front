# Architecture

## System overview

```
                ┌────────────────────────────┐
                │           VERCEL           │
                │  React SPA (Vite build)    │
                │  static + SPA rewrites     │
                └─────────────┬──────────────┘
                              │ HTTPS (Supabase JS client)
                              ▼
                ┌────────────────────────────┐
                │          SUPABASE          │
                │  Auth  │ Postgres │ Storage│
                │  (JWT) │  + RLS   │ (files)│
                └─────────────┬──────────────┘
                              │ HTTPS (JSON / JWT)
                              ▼
                ┌────────────────────────────┐
                │      EDGE FUNCTIONS        │
                │ storage-api  api-keys      │
                │ delete-account  oauth-*    │
                └────────────────────────────┘
```

CloudGather is a SPA frontend on Vercel backed by a Supabase project (Postgres, Auth,
Storage) and Deno Edge Functions. This satisfies the platform goals (managed relational
data, object storage, serverless API) with the least operational surface: Supabase
provides D1/R2-equivalents (Postgres/Storage) plus managed auth, which the product needs
anyway. The functions run on the same Deno runtime model as Cloudflare Workers.

## Frontend

- **Vite + React 18 + TypeScript**, strict type checking (`npm run typecheck`).
- **Routing:** `react-router` data router with per-route code splitting (`lazy`).
  The entry bundle is ~143 KB (43 KB gzipped); every page is its own chunk.
- **State:** TanStack Query for server state; React context only for auth.
- **Data access:** all Supabase calls live in `src/services/files.ts` (single data layer)
  so RLS assumptions and error mapping are testable in one place.
- **Auth context** (`src/contexts/AuthContext.tsx`): session listener, profile fetch with
  retry (profiles rows are created by a DB trigger), admin status via the `is_admin_user()`
  SECURITY DEFINER RPC — never from client-writable columns.
- **Design system:** Tailwind tokens in `src/index.css` (indigo/cyan brand, semantic
  success/warning colors, dark mode via `next-themes`), shadcn-style primitives in
  `src/components/ui`.

## Data model (Postgres)

| Table | Purpose |
| --- | --- |
| `profiles` | One per user (created by `on_auth_user_created` trigger). Holds display name, avatar, role, and a `settings` JSONB preferences document. |
| `files` | Unified file catalog: real rows for CloudGather-stored uploads (`provider_file_id` = storage path) and index rows for provider files. Self-referencing `parent_folder_id`, computed `path` for subtree queries. |
| `storage_providers` | Per-user provider connections incl. OAuth tokens (server-side only). |
| `file_shares` | Email-based shares with `permission_level` and `expires_at`. |
| `api_keys` | Personal API keys: `key_hash` (SHA-256), `key_prefix`, JSONB `permissions`. Plaintext keys are never stored. |
| `audit_logs` | Append-only activity trail (`user_id`, `action`, `resource_type`, `details`). |
| `system_settings` | Admin-managed platform configuration (JSONB values). |
| `admin_users` | Admin identity by email — read only via `is_admin_user()` RPC. |
| `blog_posts` | Public blog content authored from the admin console. |
| `teams`, `team_members`, `usage_analytics` | Schema present for the team/usage roadmap; not yet surfaced in the UI. |

### Key invariants

- Every user-owned table has RLS enabled with per-user policies; the service-role key is
  used only inside edge functions with explicit `user_id` scoping.
- `files.path` is kept consistent by the service layer on create/rename/delete so
  subtree operations (`like 'path/%'`) remain correct.
- File names are unique per (user, folder) once any legacy duplicates are cleaned
  (the migration prints a cleanup query if it finds any).

## API design (public REST API)

`storage-api` exposes `/api/v1/...` authenticated with the `x-api-key` header:

- Keys are verified by hashing the presented key and looking up `key_hash`.
- Permission model: `read`, `write`, `share` (stored per key).
- Fixed-window rate limit (100 req/min/key) plus platform-level gateway limits.
- Errors are JSON `{ "error": string }` with appropriate status codes
  (400/401/403/404/409/413/429/500); internals are never leaked.

## Security model

- **Authentication:** Supabase Auth (email+password, configurable OAuth). Sessions are
  JWTs held in cookies/localStorage managed by the client library.
- **Authorization:** RLS is the boundary. The UI's `ProtectedRoute`/`AdminRoute` gates are
  convenience only; every query is independently protected server-side. Admin status is
  resolved through `is_admin_user()` (SECURITY DEFINER) so users cannot self-escalate via
  the client-writable `profiles.role` column.
- **Secrets:** publishable keys live in the frontend by design; everything else
  (`SUPABASE_SERVICE_ROLE_KEY`, OAuth client secrets) lives in edge-function secrets.
  Account deletion, API-key hashing and provider token storage all happen server-side.
- **Headers:** `vercel.json` sets CSP, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy` and immutable asset caching.
- See `docs/SECURITY.md` for the audit summary.

## SEO architecture

- Per-route `<Seo>` component manages title/description/canonical/OG/Twitter/JSON-LD.
- Structured data: `Organization`, `WebSite`, `SoftwareApplication`, `FAQPage` (only for
  genuinely visible FAQ content), `BlogPosting`, `BreadcrumbList`. Nothing fabricated
  (no fake ratings/reviews).
- `public/robots.txt` disallows all authenticated routes; `public/sitemap.xml` lists only
  the public canonical URLs. Protected/error pages emit `noindex`.
- `VITE_PUBLIC_SITE_URL` controls the canonical origin per environment — set it to the
  production domain so canonicals and sitemap stay consistent.
