# CloudGather

**One home for every cloud.** CloudGather is a unified workspace for browsing,
organising, sharing and managing files across every cloud-storage account you
already own — plus its own managed storage, a developer API and an admin console.

## Stack

- React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query
- Vercel static frontend
- Cloudflare Worker API (D1 · R2 · KV · Cron Triggers)
- Vitest and Testing Library

## Local development

```bash
npm ci
cp .env.example .env            # frontend: VITE_API_URL, VITE_PUBLIC_SITE_URL
cp .dev.vars.example .dev.vars  # worker secrets — every entry is optional
npm run cf:migrate:local        # 0001 schema → 0002 platform → 0003 seed
npm run cf:dev                  # Worker on :8787
npm run dev                     # frontend on :8080
```

The first account registered with the address in `ADMIN_EMAIL` becomes the
administrator. Without an email provider configured, outbound mail is queued in
the `email_outbox` table and readable from **Admin → Operations**, so sign-up,
verification and reset flows still work locally.

## Validation

```bash
npm run typecheck     # frontend + tests
npm run cf:typecheck  # worker (strict, workers-types)
npm test              # vitest
npm run build         # production bundle
```

## What is where

| Area | Entry point |
| --- | --- |
| Marketing site | `src/pages/{Landing,Features,Pricing,Developers,Blog,About,Contact,Status,Privacy,Terms}Page.tsx` |
| Authentication | `src/pages/{Auth,ResetPassword,VerifyEmail,AuthCallback}Page.tsx`, `src/contexts/AuthContext.tsx` |
| Workspace | `src/pages/{Dashboard,Files,Recents,Shared,Trash,Storage,Providers}Page.tsx` |
| Account | `src/pages/{Settings,Notifications,Billing,ApiKeys,Webhooks}Page.tsx` |
| Admin console | `src/pages/AdminPage.tsx` + `src/components/admin/*` |
| API | `worker/src/index.ts`, `worker/src/routes/*` |
| Schema | `worker/migrations/*.sql` |

## Configuration philosophy

Every integration is a capability flag. When a secret is absent the Worker
reports that capability as `false` through `/api/config` and the UI hides or
explains the affected flow — it never fakes success. Add the key, redeploy, and
the feature lights up.

See `docs/ARCHITECTURE.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md` and
`.dev.vars.example` for the full list of keys and the external setup each needs.
