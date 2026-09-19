# Supabase backend

This directory contains the database migrations and Deno edge functions that make up the
CloudGather backend.

## Migrations

Apply in order with `supabase db push`. The most recent migration,
`20260907000000_productionize.sql`, is **idempotent** and reconciles earlier partial
schema revisions (including the plaintext `api_keys.key` column, which it hashes and
drops). If it prints a NOTICE about duplicate file names, run the cleanup query it
provides and re-run the push to install the unique per-folder file-name index.

## Edge functions

| Function | Status | Auth | Notes |
| --- | --- | --- | --- |
| `storage-api` | **Production** | API key (`x-api-key`, hashed lookup) | Public REST API `/api/v1/...`. Requires `SUPABASE_SERVICE_ROLE_KEY`. Rate-limited per key. |
| `api-key-management` | **Production** | User JWT | Create/list/revoke keys. Plaintext shown once. Requires service-role key. |
| `delete-account` | **Production** | User JWT | Full data cascade. Requires service-role key. Set `DELETE_AUDIT_LOGS=true` to also erase audit history. |
| `google-drive-auth` | **Reference implementation** | User JWT (start) + OAuth state (callback) | Complete working flow once `GOOGLE_CLIENT_ID/SECRET` + `REDIRECT_URI` are set. Template for the other providers. |
| `dropbox-auth`, `onedrive-auth`, `box-auth`, `backblaze-auth`, `mega-auth`, `pcloud-auth`, `yandex-disk-auth`, `icedrive-auth`, `sync-auth`, `amazon-s3-auth` | **Scaffold** | — | Older revisions identified callers with a server-side `getSession()` (always unauthenticated) and must be brought up to the `google-drive-auth` pattern before enabling. The UI surfaces an honest "not configured" state for them. |
| `list-files`, `list-provider-files` | **Scaffold** | — | Provider metadata listing; same caveat as above. |
| `sync-auth` | **Scaffold** | — | Credential-based provider connects; verify + store server-side before enabling. |

### Deploying

```bash
supabase functions deploy storage-api
supabase functions deploy api-key-management
supabase functions deploy delete-account
supabase functions deploy google-drive-auth
# …and any others you configure
```

### Secrets

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
supabase secrets set ALLOWED_ORIGIN=https://your-domain.com
supabase secrets set GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… REDIRECT_URI=https://your-domain.com/providers
```

Never put service-role keys in the frontend or in `VITE_*` variables.

## Completing a provider OAuth function

Follow `google-drive-auth/index.ts`:

1. Verify the caller's JWT (`getUserIdFromJwt`) on `POST { action: "start" }`.
2. Return the provider's consent URL with a `state` parameter encoding `userId` + nonce.
3. On the callback route, validate `state`, exchange the code for tokens, and upsert the
   `storage_providers` row (`provider_name`, tokens, quota, email, priority).
4. Redirect back to `/providers?connect=success|error`.
