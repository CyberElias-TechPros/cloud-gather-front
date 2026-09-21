# Deployment

## 1. Security prerequisite

Use a scoped Cloudflare API token, not a Global API Key. Grant only Workers Scripts, D1, and R2 edit access. Never place credentials in Git or Vercel client variables.

## 2. Cloudflare resources

```bash
npx wrangler login
npx wrangler d1 create cloudgather
npx wrangler d1 create cloudgather-preview
npx wrangler r2 bucket create cloudgather-files
npx wrangler r2 bucket create cloudgather-files-preview
```

Copy the returned D1 IDs into `wrangler.toml`. Set `ALLOWED_ORIGINS` to the exact Vercel production/preview origins and `APP_URL` to the production frontend origin.

Set server secrets:

```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put FROM_EMAIL
# Later, provider-specific secrets such as GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
```

Apply and deploy:

```bash
npm run cf:typecheck
npm run cf:migrate:remote
npm run cf:deploy
```

Register the account matching `ADMIN_EMAIL` first; it receives the initial admin role. Further admins can be managed in the console.

## 3. Vercel

Import the repository, use the Vite preset, and configure:

```text
VITE_API_URL=https://<worker-domain>/api
VITE_PUBLIC_SITE_URL=https://<frontend-domain>
```

Deploy. If using a custom Worker API domain, add that exact domain to `connect-src` in `vercel.json`.

## 4. Verification

1. `GET /api/health` returns 200.
2. Register, log out, and log in.
3. Request and complete a password reset.
4. Create a folder; upload, preview/download, rename, star, and delete a file.
5. Create/revoke a share and API key.
6. Export and delete a disposable account.
7. Verify admin statistics, role management, and settings.
8. Verify CORS rejects an unlisted origin.

Provider OAuth remains unavailable until each provider's external app credentials and callback registration are supplied; the UI reports that state honestly.
