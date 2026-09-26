/** Health, public configuration, status page data and live announcements. */
import { Router } from "../core/router";
import { all, count, first } from "../core/db";
import { json } from "../core/http";
import { getSettings } from "../core/settings";
import { capabilities, emailProvider, appUrl, apiUrl, isProduction } from "../env";
import { PLANS, purchasablePlans } from "../billing/plans";
import { catalogue, ROADMAP_PROVIDERS } from "../providers/index";
import { socialProviderIds } from "./social";
import { API_SCOPES } from "./apikeys";
import { WEBHOOK_EVENTS } from "../core/webhooks";
import { CONTACT_TOPICS } from "./contact";

export const systemRoutes = new Router();

export const API_VERSION = "1.0.0";

async function checkDatabase(env: Parameters<typeof first>[0]): Promise<{ ok: boolean; latency_ms: number; error?: string }> {
  const started = Date.now();
  try {
    await first(env, "SELECT 1 AS ok");
    return { ok: true, latency_ms: Date.now() - started };
  } catch (error) {
    return { ok: false, latency_ms: Date.now() - started, error: String(error).slice(0, 200) };
  }
}

systemRoutes.get("/api/health", async (ctx) => {
  const started = Date.now();
  const database = await checkDatabase(ctx.env);

  let storage = { ok: true, latency_ms: 0, error: undefined as string | undefined };
  const storageStarted = Date.now();
  try {
    await ctx.env.FILES.head("healthcheck");
    storage.latency_ms = Date.now() - storageStarted;
  } catch (error) {
    storage = { ok: false, latency_ms: Date.now() - storageStarted, error: String(error).slice(0, 200) };
  }

  const checks = {
    database,
    storage,
    email: { ok: Boolean(emailProvider(ctx.env)), provider: emailProvider(ctx.env) ?? "outbox-only" },
    encryption: { ok: Boolean(ctx.env.ENCRYPTION_KEY) },
    billing: { ok: Boolean(ctx.env.STRIPE_SECRET_KEY) },
  };
  const healthy = database.ok && storage.ok;

  return json(
    {
      status: healthy ? "ok" : "degraded",
      version: API_VERSION,
      environment: ctx.env.ENVIRONMENT || "production",
      time: new Date().toISOString(),
      uptime_check_ms: Date.now() - started,
      checks,
    },
    healthy ? 200 : 503,
  );
}, { maintenanceSafe: true, summary: "Service health probe" });

systemRoutes.get("/api/version", async () => json({ version: API_VERSION }), { maintenanceSafe: true });

systemRoutes.get("/api/config", async (ctx) => {
  const settings = await getSettings(ctx.env);
  return json({
    app: {
      name: settings.app_name,
      url: appUrl(ctx.env),
      api_url: apiUrl(ctx.env),
      environment: ctx.env.ENVIRONMENT || "production",
      version: API_VERSION,
      production: isProduction(ctx.env),
      support_email: settings.support_email || ctx.env.SUPPORT_EMAIL || null,
    },
    policy: {
      registration_enabled: settings.registration_enabled,
      require_email_verification: settings.require_email_verification,
      maintenance_mode: settings.maintenance_mode,
      maintenance_message: settings.maintenance_message,
      max_file_size_mb: settings.max_file_size_mb,
      trash_retention_days: settings.trash_retention_days,
      allow_public_links: settings.allow_public_links,
      password: {
        min_length: settings.password_min_length,
        require_mixed_case: settings.password_require_mixed_case,
        require_number: settings.password_require_number,
        require_symbol: settings.password_require_symbol,
      },
      signup_domain_allowlist: settings.signup_domain_allowlist
        ? settings.signup_domain_allowlist.split(",").map((value) => value.trim()).filter(Boolean)
        : [],
    },
    capabilities: capabilities(ctx.env),
    turnstile_site_key: ctx.env.TURNSTILE_SECRET_KEY ? ctx.env.TURNSTILE_SITE_KEY || null : null,
    social_providers: socialProviderIds.filter((provider) => capabilities(ctx.env).social[provider as "google" | "github" | "microsoft"]),
    storage_providers: catalogue(ctx.env),
    roadmap_providers: ROADMAP_PROVIDERS,
    plans: PLANS,
    purchasable_plans: purchasablePlans(ctx.env),
    api_scopes: API_SCOPES,
    webhook_events: WEBHOOK_EVENTS,
    contact_topics: CONTACT_TOPICS,
    announcement: settings.announcement || null,
  });
}, { maintenanceSafe: true, summary: "Public runtime configuration for the web client" });

systemRoutes.get("/api/announcements", async (ctx) => {
  const rows = await all(
    ctx.env,
    `SELECT id, title, body, level, audience, starts_at, ends_at FROM announcements
      WHERE published = 1
        AND (starts_at IS NULL OR datetime(starts_at) <= datetime('now'))
        AND (ends_at IS NULL OR datetime(ends_at) >= datetime('now'))
      ORDER BY created_at DESC LIMIT 5`,
  );
  const audience = ctx.user ? (ctx.user.plan === "free" ? ["all", "free"] : ["all", "paid"]) : ["all"];
  if (ctx.user?.role === "admin") audience.push("admins");
  return json({ announcements: rows.filter((row) => audience.includes(String((row as { audience: string }).audience))) });
}, { maintenanceSafe: true, summary: "Active banner announcements" });

systemRoutes.get("/api/status", async (ctx) => {
  const database = await checkDatabase(ctx.env);
  let storageOk = true;
  try {
    await ctx.env.FILES.head("healthcheck");
  } catch {
    storageOk = false;
  }

  const [pendingEmails, failedWebhooks, providerErrors, recentIncidents] = await Promise.all([
    count(ctx.env, "SELECT COUNT(*) AS total FROM email_outbox WHERE status = 'pending'"),
    count(ctx.env, "SELECT COUNT(*) AS total FROM webhook_deliveries WHERE status = 'failed' AND datetime(created_at) > datetime('now','-1 day')"),
    count(ctx.env, "SELECT COUNT(*) AS total FROM storage_providers WHERE status = 'error'"),
    all(
      ctx.env,
      `SELECT id, title, body, level, starts_at, ends_at, created_at FROM announcements
        WHERE published = 1 AND level IN ('warning','critical') AND datetime(created_at) > datetime('now','-30 days')
        ORDER BY created_at DESC LIMIT 10`,
    ),
  ]);

  const components = [
    { id: "api", name: "API", status: "operational" as const },
    { id: "database", name: "Database", status: database.ok ? ("operational" as const) : ("outage" as const) },
    { id: "storage", name: "Object storage", status: storageOk ? ("operational" as const) : ("outage" as const) },
    { id: "email", name: "Email delivery", status: emailProvider(ctx.env) ? (pendingEmails > 50 ? ("degraded" as const) : ("operational" as const)) : ("degraded" as const) },
    { id: "webhooks", name: "Webhooks", status: failedWebhooks > 25 ? ("degraded" as const) : ("operational" as const) },
    { id: "providers", name: "Cloud connections", status: providerErrors > 10 ? ("degraded" as const) : ("operational" as const) },
  ];
  const worst = components.some((component) => component.status === "outage")
    ? "outage"
    : components.some((component) => component.status === "degraded")
      ? "degraded"
      : "operational";

  return json({
    status: worst,
    updated_at: new Date().toISOString(),
    components,
    incidents: recentIncidents,
    metrics: { pending_emails: pendingEmails, failed_webhooks_24h: failedWebhooks, provider_errors: providerErrors },
  });
}, { maintenanceSafe: true, summary: "Public status page payload" });
