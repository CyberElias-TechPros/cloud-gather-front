# CloudGather

**One home for every cloud.** CloudGather provides a unified interface for browsing, organizing, sharing, and managing files across cloud-storage providers.

## Stack

- React 18, TypeScript, Vite, Tailwind CSS
- Vercel static frontend
- Cloudflare Worker API
- Cloudflare D1 relational data
- Cloudflare R2 private object storage
- Vitest and Testing Library

## Local development

```bash
npm ci
cp .env.example .env
npm run cf:migrate:local
npm run cf:dev        # Worker on :8787
npm run dev           # frontend on :8080
```

## Validation

```bash
npm run typecheck
npm run cf:typecheck
npm test
npm run build
```

## Product areas

Public marketing, pricing, feature, developer, blog, policy and company pages; authenticated dashboard, files, recents, storage analytics, provider management, API keys and settings; and a server-authorized admin console.

See `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, and `worker/README.md`.

External cloud providers require their own OAuth applications and secrets. The codebase does not fake a successful connection when credentials are absent.
