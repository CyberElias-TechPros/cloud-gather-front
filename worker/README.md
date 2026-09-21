# CloudGather Cloudflare backend

A Cloudflare Worker API backed by D1 and R2. It implements password/session authentication, user profiles, file/folder CRUD, uploads/downloads, providers, personal API keys, exports, public blog reads, audit logs, and admin stats.

## Security

- Passwords use PBKDF2-SHA-256 with per-user random salt and 210,000 iterations.
- Only SHA-256 session/API-key hashes are stored; raw values are shown once.
- Every private query scopes by the authenticated user ID.
- R2 object keys are user-prefixed and never exposed as public URLs.
- CORS is an explicit origin allowlist. Errors include request IDs without leaking internals.
- Uploads are capped at 100 MB. D1 constraints enforce uniqueness and lifecycle integrity.

## Local development

```bash
npm ci
npm run cf:migrate:local
npm run cf:dev
```

The local Worker runs on port 8787. Set `VITE_API_URL=http://localhost:8787/api` for a separately served frontend, or proxy `/api` to the Worker.

## Provision and deploy

Use a scoped Cloudflare API token (Workers Scripts, D1, and R2 permissions), never a Global API Key.

```bash
npx wrangler login
npx wrangler d1 create cloudgather
npx wrangler d1 create cloudgather-preview
npx wrangler r2 bucket create cloudgather-files
npx wrangler r2 bucket create cloudgather-files-preview
# Put returned D1 IDs into wrangler.toml.
npx wrangler d1 migrations apply cloudgather --remote
# Add the Vercel production origin to ALLOWED_ORIGINS in wrangler.toml.
npm run cf:deploy
```

Provider OAuth requires provider-specific client IDs/secrets and callback registration. Those external credentials are deliberately not faked or committed. Store each with `wrangler secret put ...`; implement provider adapters only after the operator supplies the corresponding provider credentials.
