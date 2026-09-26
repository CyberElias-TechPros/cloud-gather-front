/// <reference types="@cloudflare/workers-types" />

/**
 * Runtime bindings and configuration for the CloudGather API Worker.
 *
 * Everything optional is a *capability flag*: when the secret is absent the
 * related feature reports itself as "not configured" instead of failing in a
 * confusing way or pretending to work. Add the key, redeploy, feature lights up.
 */
export interface Env {
  /* ---- Bindings ---------------------------------------------------- */
  DB: D1Database;
  FILES: R2Bucket;
  /** Optional KV namespace used for rate limiting + settings cache. Falls back to D1. */
  KV?: KVNamespace;

  /* ---- Core ---------------------------------------------------------- */
  ALLOWED_ORIGINS: string;
  APP_URL?: string;
  API_URL?: string;
  ENVIRONMENT?: string;
  SESSION_TTL_DAYS?: string;
  ADMIN_EMAIL?: string;
  /** base64-encoded 32-byte key. Encrypts provider credentials and TOTP secrets. */
  ENCRYPTION_KEY?: string;

  /* ---- Transactional email ------------------------------------------- */
  /** resend | postmark | sendgrid | mailchannels | none */
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  POSTMARK_TOKEN?: string;
  SENDGRID_API_KEY?: string;
  FROM_EMAIL?: string;
  FROM_NAME?: string;
  SUPPORT_EMAIL?: string;

  /* ---- Social sign-in -------------------------------------------------- */
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  MICROSOFT_CLIENT_ID?: string;
  MICROSOFT_CLIENT_SECRET?: string;
  MICROSOFT_TENANT?: string;

  /* ---- Storage provider OAuth ------------------------------------------ */
  GOOGLE_DRIVE_CLIENT_ID?: string;
  GOOGLE_DRIVE_CLIENT_SECRET?: string;
  DROPBOX_CLIENT_ID?: string;
  DROPBOX_CLIENT_SECRET?: string;
  ONEDRIVE_CLIENT_ID?: string;
  ONEDRIVE_CLIENT_SECRET?: string;
  ONEDRIVE_TENANT?: string;
  BOX_CLIENT_ID?: string;
  BOX_CLIENT_SECRET?: string;

  /* ---- Billing (Stripe) ------------------------------------------------ */
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_PRO_MONTHLY?: string;
  STRIPE_PRICE_PRO_YEARLY?: string;
  STRIPE_PRICE_TEAM_MONTHLY?: string;
  STRIPE_PRICE_TEAM_YEARLY?: string;
  BILLING_PORTAL_RETURN_PATH?: string;

  /* ---- Abuse prevention / observability -------------------------------- */
  TURNSTILE_SECRET_KEY?: string;
  SENTRY_DSN?: string;
  LOG_LEVEL?: string;
}

export const isProduction = (env: Env) => (env.ENVIRONMENT || "production") === "production";

/** Public, non-secret capability map — consumed by the frontend to hide dead UI. */
export function capabilities(env: Env) {
  return {
    email: Boolean(emailProvider(env)),
    encryption: Boolean(env.ENCRYPTION_KEY),
    billing: Boolean(env.STRIPE_SECRET_KEY),
    turnstile: Boolean(env.TURNSTILE_SECRET_KEY),
    social: {
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
      microsoft: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
    },
    providers: {
      "google-drive": Boolean(
        (env.GOOGLE_DRIVE_CLIENT_ID || env.GOOGLE_CLIENT_ID) &&
          (env.GOOGLE_DRIVE_CLIENT_SECRET || env.GOOGLE_CLIENT_SECRET),
      ),
      dropbox: Boolean(env.DROPBOX_CLIENT_ID && env.DROPBOX_CLIENT_SECRET),
      onedrive: Boolean(
        (env.ONEDRIVE_CLIENT_ID || env.MICROSOFT_CLIENT_ID) &&
          (env.ONEDRIVE_CLIENT_SECRET || env.MICROSOFT_CLIENT_SECRET),
      ),
      box: Boolean(env.BOX_CLIENT_ID && env.BOX_CLIENT_SECRET),
      "amazon-s3": true,
      backblaze: true,
      "s3-compatible": true,
    } as Record<string, boolean>,
  };
}

export function emailProvider(env: Env): "resend" | "postmark" | "sendgrid" | null {
  const explicit = (env.EMAIL_PROVIDER || "").toLowerCase();
  if (explicit === "none") return null;
  if (explicit === "resend" && env.RESEND_API_KEY) return "resend";
  if (explicit === "postmark" && env.POSTMARK_TOKEN) return "postmark";
  if (explicit === "sendgrid" && env.SENDGRID_API_KEY) return "sendgrid";
  if (env.RESEND_API_KEY) return "resend";
  if (env.POSTMARK_TOKEN) return "postmark";
  if (env.SENDGRID_API_KEY) return "sendgrid";
  return null;
}

export const appUrl = (env: Env) => (env.APP_URL || "http://localhost:8080").replace(/\/$/, "");
export const apiUrl = (env: Env) => (env.API_URL || `${appUrl(env)}/api`).replace(/\/$/, "");
