# Deployment guide

Two deployments are required: the **frontend on Vercel** and the **backend on Supabase**
(database + auth + storage + edge functions).

## 0. Prerequisites

- Node 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- A Vercel account
- A Supabase project (new or existing)

## 1. Supabase backend

### 1.1 Database

```bash
supabase link --project-ref <your-project-ref>
supabase db push        # applies supabase/migrations in order
```

The final migration (`20260907000000_productionize.sql`) is idempotent and:

- adds `profiles.settings`, creates missing profile rows and the signup trigger
- reconciles the legacy `api_keys` plaintext schema to hashed keys
- fixes RLS gaps (admin policies, audit-log write policy, `admin_users` visibility)
- adds the hot-path indexes

> If the migration prints a NOTICE about duplicate file names, run the cleanup query it
> provides, then re-run `supabase db push` so the unique index is installed.

### 1.2 Storage

The `user_uploads` private bucket (100 MB limit) is created by an earlier migration.
Verify it exists under **Storage** in the dashboard; RLS policies scope objects to
`<user_id>/<filename>` prefixes.

### 1.3 Edge functions

```bash
supabase functions deploy storage-api
supabase functions deploy api-key-management
supabase functions deploy delete-account
supabase functions deploy google-drive-auth   # plus any other <provider>-auth you configure
supabase functions deploy sync-auth
supabase functions deploy list-files
supabase functions deploy list-provider-files
```

Secrets (dashboard → Edge Functions → Secrets, or `supabase secrets set`):

| Secret | Required by | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | storage-api, api-key-management, delete-account, oauth callbacks | Project Settings → API. Keep server-side only. |
| `ALLOWED_ORIGIN` | all functions | Set to your production origin to pin CORS instead of `*`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | google-drive-auth | From Google Cloud console (OAuth client, redirect URI below). |
| `REDIRECT_URI` | OAuth functions | `https://<your-domain>/providers` |
| `<PROVIDER>_CLIENT_ID/SECRET` | other `*-auth` functions | Per provider; see `supabase/README.md`. |

Also enable **Google** under Auth → Providers if you want Google sign-in for accounts.

### 1.4 Auth URLs

Auth → URL configuration:

- **Site URL:** `https://<your-domain>`
- **Redirect URLs:** `https://<your-domain>/login`, `https://<your-domain>/reset-password`

Password reset emails redirect to `/reset-password`, where the user sets a new password.

## 2. Vercel frontend

1. Import the repository into Vercel.
2. Framework preset: **Vite** (build `npm run build`, output `dist` — also in `vercel.json`).
3. Environment variables (Production + Preview):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | the anon/publishable key |
   | `VITE_PUBLIC_SITE_URL` | `https://<your-domain>` (use the preview URL for Preview env) |

4. Deploy. `vercel.json` provides SPA rewrites, immutable asset caching and security
   headers (CSP allows only Supabase origins for API/websocket traffic).

## 3. Post-deploy checklist

- [ ] Sign up a test account; confirm the confirmation email flow works.
- [ ] `/reset-password` completes a real reset.
- [ ] Upload a file; check it appears in Storage under `<user_id>/…` and can be
      downloaded and deleted.
- [ ] Create an API key, then call the API:
      `curl https://<ref>.supabase.co/functions/v1/storage-api/api/v1/files -H "x-api-key: cg_…"`
- [ ] Delete the test account from Settings → Data; verify rows and objects are gone.
- [ ] Add the production sitemap in Google Search Console
      (`https://<your-domain>/sitemap.xml`).
- [ ] Confirm `/robots.txt` and canonical URLs use the production origin.

## 4. Environments

| Environment | Frontend | Backend |
| --- | --- | --- |
| Local | `npm run dev` with `.env` | `supabase start` (local stack) or a dev project |
| Preview | Vercel preview per PR | Separate Supabase project recommended |
| Production | Vercel production | Production Supabase project |

Keep separate Supabase projects per environment so migrations can be validated safely.

## 5. Known environment-dependent items

- **Provider OAuth** (Google Drive etc.) requires operator-issued client IDs/secrets.
  The Providers page surfaces an honest "not configured" state until secrets are set;
  `google-drive-auth` is the reference implementation for completing the others.
- **Email sending** (confirmation/reset) uses Supabase's built-in email. Configure a
  custom SMTP provider for production volume.
- **Team features** (`teams`, `team_members` tables exist) are roadmap; the Team page was
  removed because it was a non-functional mock.
