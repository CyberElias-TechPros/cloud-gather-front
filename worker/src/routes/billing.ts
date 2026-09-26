/** Plans, subscriptions, checkout, customer portal, invoices and Stripe webhooks. */
import { Router } from "../core/router";
import { requireUser } from "../core/context";
import { all, first, run } from "../core/db";
import { badRequest, conflict, json, notFound, readJson, unauthorized } from "../core/http";
import { audit } from "../core/audit";
import { getEntitlements } from "../core/entitlements";
import { notify } from "../core/notify";
import { templates } from "../core/email";
import { dispatch } from "../core/webhooks";
import { id, now } from "../core/util";
import type { Ctx } from "../core/context";
import type { Env } from "../env";
import { appUrl } from "../env";
import { PLANS, getPlan, planFromPriceId, purchasablePlans, stripePriceId, type BillingInterval, type PlanId } from "../billing/plans";
import {
  cancelSubscription,
  createCheckoutSession,
  createCustomer,
  createPortalSession,
  listInvoices,
  requireStripe,
  resumeSubscription,
  stripeEnabled,
  verifyWebhookSignature,
  type StripeSubscription,
} from "../billing/stripe";

export const billingRoutes = new Router();

const toIso = (seconds: number | null | undefined) => (seconds ? new Date(seconds * 1000).toISOString() : null);

billingRoutes.get("/api/billing/plans", async (ctx) => {
  const purchasable = stripeEnabled(ctx.env) ? purchasablePlans(ctx.env) : [];
  return json({
    plans: PLANS.map((plan) => ({
      ...plan,
      price_ids: {
        monthly: stripePriceId(ctx.env, plan.id, "monthly") ? true : false,
        yearly: stripePriceId(ctx.env, plan.id, "yearly") ? true : false,
      },
      purchasable: purchasable.includes(plan.id),
    })),
    billing_enabled: stripeEnabled(ctx.env),
    currency: "usd",
  });
}, { maintenanceSafe: true, summary: "Public plan catalogue" });

billingRoutes.get("/api/billing/subscription", async (ctx) => {
  const user = requireUser(ctx);
  const entitlements = await getEntitlements(ctx.env, user);
  const subscription = await first(ctx.env, "SELECT * FROM subscriptions WHERE user_id = ?", user.id);
  const invoices = await all(
    ctx.env,
    "SELECT id, number, amount_paid, currency, status, hosted_invoice_url, invoice_pdf, period_start, period_end, created_at FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
    user.id,
  );
  return json({
    plan: entitlements.plan,
    limits: entitlements.limits,
    usage: entitlements.usage,
    storage_percent: entitlements.storagePercent,
    capabilities: entitlements.capabilities,
    subscription: subscription ?? null,
    invoices,
    billing_enabled: stripeEnabled(ctx.env),
  });
}, { auth: true, summary: "Current plan, usage and invoices" });

billingRoutes.post("/api/billing/checkout", async (ctx) => {
  const user = requireUser(ctx);
  requireStripe(ctx.env);
  const payload = await readJson<{ plan: string; interval?: string }>(ctx.request);
  const planId = payload.plan as PlanId;
  const plan = PLANS.find((entry) => entry.id === planId);
  if (!plan || plan.id === "free") throw badRequest("Choose a paid plan to continue.", "invalid_plan");
  const interval: BillingInterval = payload.interval === "yearly" ? "yearly" : "monthly";
  const priceId = stripePriceId(ctx.env, plan.id, interval);
  if (!priceId) {
    throw badRequest(
      `No Stripe price is configured for ${plan.name} (${interval}). Set STRIPE_PRICE_${plan.id.toUpperCase()}_${interval.toUpperCase()}.`,
      "price_not_configured",
    );
  }

  let customerId = (await first<{ stripe_customer_id: string | null }>(ctx.env, "SELECT stripe_customer_id FROM users WHERE id = ?", user.id))?.stripe_customer_id;
  if (!customerId) {
    const customer = await createCustomer(ctx.env, user.email, user.display_name || user.email, user.id);
    customerId = customer.id;
    await run(ctx.env, "UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?", customerId, now(), user.id);
  }

  const session = await createCheckoutSession(ctx.env, {
    customerId,
    priceId,
    successUrl: `${appUrl(ctx.env)}/billing?checkout=success`,
    cancelUrl: `${appUrl(ctx.env)}/billing?checkout=cancelled`,
    userId: user.id,
  });
  await audit(ctx, { action: "billing.checkout_started", details: { plan: plan.id, interval } });
  return json({ url: session.url, session_id: session.id });
}, { auth: true, verified: true, rateLimit: { limit: 20, windowSeconds: 3600, by: "user" }, summary: "Start a Stripe Checkout session" });

billingRoutes.post("/api/billing/portal", async (ctx) => {
  const user = requireUser(ctx);
  requireStripe(ctx.env);
  const customerId = (await first<{ stripe_customer_id: string | null }>(ctx.env, "SELECT stripe_customer_id FROM users WHERE id = ?", user.id))?.stripe_customer_id;
  if (!customerId) throw conflict("No billing account exists yet. Start a subscription first.", "no_customer");
  const session = await createPortalSession(ctx.env, customerId, `${appUrl(ctx.env)}${ctx.env.BILLING_PORTAL_RETURN_PATH || "/billing"}`);
  return json({ url: session.url });
}, { auth: true, summary: "Open the Stripe billing portal" });

billingRoutes.post("/api/billing/cancel", async (ctx) => {
  const user = requireUser(ctx);
  requireStripe(ctx.env);
  const subscription = await first<{ provider_subscription_id: string | null }>(
    ctx.env,
    "SELECT provider_subscription_id FROM subscriptions WHERE user_id = ?",
    user.id,
  );
  if (!subscription?.provider_subscription_id) throw notFound("No active subscription found.", "no_subscription");
  const updated = await cancelSubscription(ctx.env, subscription.provider_subscription_id, true);
  await run(ctx.env, "UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = ? WHERE user_id = ?", now(), user.id);
  await audit(ctx, { action: "billing.cancelled", severity: "warning" });
  return json({ ok: true, cancel_at: toIso(updated.current_period_end) });
}, { auth: true });

billingRoutes.post("/api/billing/resume", async (ctx) => {
  const user = requireUser(ctx);
  requireStripe(ctx.env);
  const subscription = await first<{ provider_subscription_id: string | null }>(
    ctx.env,
    "SELECT provider_subscription_id FROM subscriptions WHERE user_id = ?",
    user.id,
  );
  if (!subscription?.provider_subscription_id) throw notFound("No subscription found.", "no_subscription");
  await resumeSubscription(ctx.env, subscription.provider_subscription_id);
  await run(ctx.env, "UPDATE subscriptions SET cancel_at_period_end = 0, updated_at = ? WHERE user_id = ?", now(), user.id);
  await audit(ctx, { action: "billing.resumed" });
  return json({ ok: true });
}, { auth: true });

billingRoutes.post("/api/billing/invoices/refresh", async (ctx) => {
  const user = requireUser(ctx);
  requireStripe(ctx.env);
  const customerId = (await first<{ stripe_customer_id: string | null }>(ctx.env, "SELECT stripe_customer_id FROM users WHERE id = ?", user.id))?.stripe_customer_id;
  if (!customerId) return json({ invoices: [] });
  const result = await listInvoices(ctx.env, customerId, 20);
  for (const invoice of result.data) {
    await upsertInvoice(ctx.env, user.id, invoice);
  }
  const invoices = await all(ctx.env, "SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT 20", user.id);
  return json({ invoices });
}, { auth: true, rateLimit: { limit: 10, windowSeconds: 3600, by: "user" } });

async function upsertInvoice(env: Env, userId: string, invoice: Record<string, unknown>) {
  await run(
    env,
    `INSERT INTO invoices(id, user_id, provider_invoice_id, number, amount_due, amount_paid, currency, status, hosted_invoice_url, invoice_pdf, period_start, period_end)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(provider_invoice_id) DO UPDATE SET
       amount_due = excluded.amount_due, amount_paid = excluded.amount_paid, status = excluded.status,
       hosted_invoice_url = excluded.hosted_invoice_url, invoice_pdf = excluded.invoice_pdf`,
    id(),
    userId,
    String(invoice.id ?? ""),
    (invoice.number as string) ?? null,
    Number(invoice.amount_due ?? 0),
    Number(invoice.amount_paid ?? 0),
    String(invoice.currency ?? "usd"),
    String(invoice.status ?? "draft"),
    (invoice.hosted_invoice_url as string) ?? null,
    (invoice.invoice_pdf as string) ?? null,
    invoice.period_start ? new Date(Number(invoice.period_start) * 1000).toISOString() : null,
    invoice.period_end ? new Date(Number(invoice.period_end) * 1000).toISOString() : null,
  ).catch(() => undefined);
}

/* ------------------------------------------------------------ webhook */

billingRoutes.post("/api/billing/webhook", async (ctx) => {
  const secret = ctx.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw badRequest("Stripe webhooks are not configured (STRIPE_WEBHOOK_SECRET missing).", "webhook_not_configured");
  const payload = await ctx.request.text();
  const valid = await verifyWebhookSignature(secret, payload, ctx.request.headers.get("stripe-signature"));
  if (!valid) throw unauthorized("Invalid Stripe signature.", "invalid_signature");

  const event = JSON.parse(payload) as { id: string; type: string; data: { object: Record<string, unknown> } };
  const duplicate = await first<{ id: string }>(ctx.env, "SELECT id FROM billing_events WHERE provider_event_id = ?", event.id);
  if (duplicate) return json({ received: true, duplicate: true });

  await run(
    ctx.env,
    "INSERT INTO billing_events(id, provider_event_id, type, payload) VALUES(?, ?, ?, ?)",
    id(),
    event.id,
    event.type,
    payload.slice(0, 20000),
  ).catch(() => undefined);

  try {
    await handleStripeEvent(ctx, event);
    await run(ctx.env, "UPDATE billing_events SET processed_at = ? WHERE provider_event_id = ?", now(), event.id);
  } catch (error) {
    await run(ctx.env, "UPDATE billing_events SET error = ? WHERE provider_event_id = ?", String(error).slice(0, 500), event.id);
    throw error;
  }
  return json({ received: true });
}, { maintenanceSafe: true, summary: "Stripe webhook receiver" });

async function handleStripeEvent(ctx: Ctx, event: { type: string; data: { object: Record<string, unknown> } }) {
  const object = event.data.object;

  const findUserId = async (): Promise<string | null> => {
    const metadataUser = ((object.metadata as Record<string, string> | undefined)?.user_id) || (object.client_reference_id as string | undefined);
    if (metadataUser) return metadataUser;
    const customerId = (object.customer as string) || null;
    if (!customerId) return null;
    const row = await first<{ id: string }>(ctx.env, "SELECT id FROM users WHERE stripe_customer_id = ?", customerId);
    return row?.id ?? null;
  };

  switch (event.type) {
    case "checkout.session.completed":
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const userId = await findUserId();
      if (!userId) return;
      const subscriptionId = (object.subscription as string) || (object.id as string);
      if (!subscriptionId) return;

      let subscription: StripeSubscription;
      if (event.type === "checkout.session.completed") {
        const { getSubscription } = await import("../billing/stripe");
        subscription = await getSubscription(ctx.env, subscriptionId);
      } else {
        subscription = object as unknown as StripeSubscription;
      }

      const priceId = subscription.items?.data?.[0]?.price?.id || "";
      const mapped = planFromPriceId(ctx.env, priceId);
      const planId: PlanId = event.type === "customer.subscription.deleted" ? "free" : mapped?.planId || "pro";
      const interval = mapped?.interval || (subscription.items?.data?.[0]?.price?.recurring?.interval === "year" ? "yearly" : "monthly");
      const active = ["active", "trialing", "past_due"].includes(subscription.status) && event.type !== "customer.subscription.deleted";

      await run(
        ctx.env,
        `INSERT INTO subscriptions(id, user_id, plan, status, interval, provider, provider_subscription_id, provider_customer_id, price_id,
                                   quantity, current_period_start, current_period_end, cancel_at_period_end, canceled_at, trial_ends_at, updated_at)
         VALUES(?, ?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           plan = excluded.plan, status = excluded.status, interval = excluded.interval,
           provider_subscription_id = excluded.provider_subscription_id, provider_customer_id = excluded.provider_customer_id,
           price_id = excluded.price_id, quantity = excluded.quantity,
           current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
           cancel_at_period_end = excluded.cancel_at_period_end, canceled_at = excluded.canceled_at,
           trial_ends_at = excluded.trial_ends_at, updated_at = excluded.updated_at`,
        id(),
        userId,
        active ? planId : "free",
        subscription.status || (active ? "active" : "canceled"),
        interval,
        subscription.id,
        subscription.customer,
        priceId,
        subscription.items?.data?.[0]?.quantity ?? 1,
        toIso(subscription.current_period_start),
        toIso(subscription.current_period_end),
        subscription.cancel_at_period_end ? 1 : 0,
        toIso(subscription.canceled_at),
        toIso(subscription.trial_end),
        now(),
      );

      await run(ctx.env, "UPDATE users SET plan = ?, stripe_customer_id = COALESCE(stripe_customer_id, ?), updated_at = ? WHERE id = ?",
        active ? planId : "free", subscription.customer, now(), userId);

      const plan = getPlan(active ? planId : "free");
      await notify(ctx.env, {
        userId,
        type: "billing.updated",
        title: `Your plan is now ${plan.name}`,
        body: active ? `Subscription status: ${subscription.status}` : "Your subscription has ended.",
        link: "/billing",
        email: templates.subscriptionChanged(ctx.env, plan.name, subscription.status || "canceled"),
      });
      await dispatch(ctx.env, userId, "billing.updated", { plan: plan.id, status: subscription.status });
      break;
    }

    case "invoice.paid":
    case "invoice.payment_failed":
    case "invoice.finalized": {
      const userId = await findUserId();
      if (!userId) return;
      await upsertInvoice(ctx.env, userId, object);
      if (event.type === "invoice.payment_failed") {
        await notify(ctx.env, {
          userId,
          type: "billing.failed",
          title: "Payment failed",
          body: "Update your payment method to keep your plan active.",
          link: "/billing",
          email: templates.paymentFailed(ctx.env),
          forceEmail: true,
        });
      }
      break;
    }

    default:
      break;
  }
}
