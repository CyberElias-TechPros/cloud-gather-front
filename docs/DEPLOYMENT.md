# Deployment

The app ships in two halves: a static SPA on Vercel and a Cloudflare Worker API
backed by D1 (SQL), R2 (objects) and KV (rate limits + settings cache).

Follow the steps in order — later steps depend on IDs and URLs produced earlier.

---

## 0. Security prerequisite

Use a scoped Cloudflare API token, never a Global API Key. Grant only
**Workers Scripts: Edit**, **D1: Edit**, **R2: Edit** and **Workers KV: Edit**.
No credential belongs in Git, and nothing secret may be exposed to Vite
(anything prefixed `VITE_` ends up in the browser bundle).

---

## 1. Create Cloudflare resources

```bash
npx wrangler login
npx wrangler d1 create cloudgather
npx wrangler d1 create cloudgather-preview
npx wrangler r2 bucket create cloudgather-files
npx wrangler r2 bucket create cloudgather-files-preview
npx wrangler kv namespace create KV
npx wrangler kv namespace create KV --preview
```

Copy every returned `database_id` / `id` into the matching binding in
`wrangler.toml` (both the top-level block and `[env.preview]`).

## 2. Non-secret vars

Edit `[vars]` in `wrangler.toml`:

| Var | Example | Notes |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | `https://app.example.com` | Exact origins, comma separated. No wildcards. |
| `APP_URL` | `https://app.example.com` | Canonical frontend origin — used in emails and OAuth redirects. |
| `API_URL` | `https://api.example.com/api` | Public API origin. |
| `ENVIRONMENT` | `production` | |
| `SESSION_TTL_DAYS` | `30` | |
| `FROM_NAME` / `SUPPORT_EMAIL` | | Appear in outbound email. |
| `LOG_LEVEL` | `info` | |
| `BILLING_PORTAL_RETURN_PATH` | `/billing` | |

## 3. Secrets

`.dev.vars.example` documents every key with its purpose. Locally,
`cp .dev.vars.example .dev.vars`. In production each is a Wrangler secret:

```bash
npx wrangler secret put <NAME>
```

Minimum for a working production deployment:

```bash
npx wrangler secret put ADMIN_EMAIL        # first account with this email becomes admin
npx wrangler secret put ENCRYPTION_KEY     # openssl rand -base64 32
npx wrangler secret put RESEND_API_KEY     # or POSTMARK_TOKEN / SENDGRID_API_KEY
npx wrangler secret put FROM_EMAIL         # on a domain verified with that provider
```

Optional, each enabling one feature (absent ⇒ the capability reports `false` in
`/api/config` and the UI hides or disables that flow — nothing pretends to work):

| Feature | Secrets | External setup |
| --- | --- | --- |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Redirect URI `{API_URL}/auth/social/google/callback` |
| GitHub sign-in | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Callback `{API_URL}/auth/social/github/callback` |
| Microsoft sign-in | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT` | Redirect `{API_URL}/auth/social/microsoft/callback` |
| Google Drive | `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` | Scope `drive.readonly`/`drive.file`; redirect `{API_URL}/providers/google-drive/callback` |
| Dropbox | `DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET` | Redirect `{API_URL}/providers/dropbox/callback` |
| OneDrive | `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`, `ONEDRIVE_TENANT` | Redirect `{API_URL}/providers/onedrive/callback` |
| Box | `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET` | Redirect `{API_URL}/providers/box/callback` |
| S3 / Backblaze / S3-compatible | *(none)* | Users supply their own keys; requires `ENCRYPTION_KEY` |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` | Webhook `{API_URL}/webhooks/stripe` (see §5) |
| Bot protection | `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY` | Turnstile widget; the site key is published via `/api/config` |
| Error tracking | `SENTRY_DSN` | |

## 4. Migrate and deploy the Worker

```bash
npm run cf:typecheck
npm run cf:migrate:remote      # 0001 schema → 0002 platform → 0003 idempotent seed
npm run cf:deploy
```

Migrations are ordered and safe to re-run. `0003` seeds platform settings, the
starter blog posts and the welcome announcement using `INSERT OR IGNORE`.

The deploy also registers the cron triggers declared in `wrangler.toml`:

| Schedule | Work |
| --- | --- |
| `*/5 * * * *` | Flush the email outbox, refresh expiring provider tokens, retry failed webhook deliveries |
| `0 3 * * *` | Purge expired trash, prune dead sessions/tokens, purge accounts past their deletion grace period |
| `0 8 * * 1` | Weekly digest emails |

Any task can also be run on demand from **Admin → Operations**.

## 5. Stripe (only if billing is enabled)

1. Create the products/prices, then set `STRIPE_PRICE_PRO_MONTHLY`,
   `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_YEARLY`.
2. Add a webhook endpoint pointing at `{API_URL}/webhooks/stripe` subscribed to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` and `invoice.payment_failed`.
3. Put the signing secret in `STRIPE_WEBHOOK_SECRET`. The Worker rejects
   unsigned or replayed payloads.

## 6. Vercel

Import the repo with the Vite preset and set:

```text
VITE_API_URL=https://<worker-domain>/api
VITE_PUBLIC_SITE_URL=https://<frontend-domain>
```

Deploy. `vercel.json` already sets caching, SPA rewrites and a strict CSP that
allows Stripe and Turnstile. **If you use a custom Worker domain, add it to
`connect-src` in `vercel.json`** — otherwise the browser blocks every API call.

## 7. First-run checklist

1. `GET /api/health` returns 200; `GET /api/config` lists the capabilities you enabled.
2. Register the account whose email matches `ADMIN_EMAIL` — it is promoted to admin on creation.
3. Sign out, sign back in, and complete a password reset end to end (checks email delivery).
4. Verify the email address from the link; confirm the banner clears.
5. Create a folder, upload a file, preview/download, rename, star, move to trash, restore, delete.
6. Create a public share link with a password + expiry and open it in a private window.
7. Connect one provider; confirm files appear in the unified tree.
8. Create an API key and call `GET /api/v1/files` with `X-API-Key`.
9. Register a webhook, trigger an upload, confirm the signed delivery.
10. Enable 2FA, sign out, sign in with a TOTP code, then test a recovery code.
11. In **Admin**, confirm statistics, the audit log, the contact inbox, announcements and settings.
12. Export account data, request deletion, then cancel it.
13. Confirm CORS rejects an unlisted origin and that a 429 is returned when a rate limit is exceeded.

## 8. Operational follow-ups

Cloudflare WAF + rate-limiting rules, log drains and alerting, scheduled D1
exports, an R2 lifecycle policy, provider-secret rotation, and email domain
verification (SPF/DKIM/DMARC) are deployment-time concerns outside the codebase.
