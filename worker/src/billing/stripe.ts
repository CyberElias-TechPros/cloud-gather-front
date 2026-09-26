/**
 * Minimal Stripe REST client for Workers — no SDK, just fetch + form encoding.
 * Every call fails loudly with a readable message when STRIPE_SECRET_KEY is absent.
 */
import type { Env } from "../env";
import { HttpError, unavailable } from "../core/http";
import { hmacSha256Hex, timingSafeEqual } from "../core/crypto";

const API = "https://api.stripe.com/v1";

export const stripeEnabled = (env: Env) => Boolean(env.STRIPE_SECRET_KEY);

export function requireStripe(env: Env): string {
  if (!env.STRIPE_SECRET_KEY) {
    throw unavailable(
      "Billing is not configured on this deployment. Add STRIPE_SECRET_KEY (and price IDs) as Worker secrets to enable paid plans.",
      "billing_not_configured",
    );
  }
  return env.STRIPE_SECRET_KEY;
}

/** Encodes nested objects/arrays the way Stripe's form API expects. */
export function encodeForm(data: Record<string, unknown>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    const field = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === "object") parts.push(encodeForm(item as Record<string, unknown>, `${field}[${index}]`));
        else parts.push(`${encodeURIComponent(`${field}[${index}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof value === "object") {
      parts.push(encodeForm(value as Record<string, unknown>, field));
    } else {
      parts.push(`${encodeURIComponent(field)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

async function stripeRequest<T>(env: Env, method: string, path: string, body?: Record<string, unknown>): Promise<T> {
  const key = requireStripe(env);
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
      "stripe-version": "2024-06-20",
    },
    body: body ? encodeForm(body) : undefined,
  });
  const payload = (await response.json()) as { error?: { message?: string; code?: string } };
  if (!response.ok) {
    throw new HttpError(response.status === 402 ? 402 : 400, payload.error?.message || "The payment provider rejected this request.", payload.error?.code || "stripe_error");
  }
  return payload as T;
}

export interface StripeCustomer {
  id: string;
  email?: string;
}

export interface StripeSession {
  id: string;
  url: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  cancel_at_period_end: boolean;
  current_period_start: number;
  current_period_end: number;
  canceled_at?: number | null;
  trial_end?: number | null;
  items: { data: { price: { id: string; recurring?: { interval?: string } }; quantity?: number }[] };
}

export const createCustomer = (env: Env, email: string, name: string, userId: string) =>
  stripeRequest<StripeCustomer>(env, "POST", "/customers", { email, name, "metadata[user_id]": userId });

export const getCustomer = (env: Env, customerId: string) => stripeRequest<StripeCustomer>(env, "GET", `/customers/${customerId}`);

export const createCheckoutSession = (env: Env, params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  userId: string;
  trialDays?: number;
  quantity?: number;
}) =>
  stripeRequest<StripeSession>(env, "POST", "/checkout/sessions", {
    mode: "subscription",
    customer: params.customerId,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    client_reference_id: params.userId,
    "line_items[0][price]": params.priceId,
    "line_items[0][quantity]": params.quantity ?? 1,
    "subscription_data[metadata][user_id]": params.userId,
    ...(params.trialDays ? { "subscription_data[trial_period_days]": params.trialDays } : {}),
    "metadata[user_id]": params.userId,
  });

export const createPortalSession = (env: Env, customerId: string, returnUrl: string) =>
  stripeRequest<StripeSession>(env, "POST", "/billing_portal/sessions", { customer: customerId, return_url: returnUrl });

export const getSubscription = (env: Env, subscriptionId: string) =>
  stripeRequest<StripeSubscription>(env, "GET", `/subscriptions/${subscriptionId}`);

export const cancelSubscription = (env: Env, subscriptionId: string, atPeriodEnd = true) =>
  atPeriodEnd
    ? stripeRequest<StripeSubscription>(env, "POST", `/subscriptions/${subscriptionId}`, { cancel_at_period_end: true })
    : stripeRequest<StripeSubscription>(env, "DELETE", `/subscriptions/${subscriptionId}`);

export const resumeSubscription = (env: Env, subscriptionId: string) =>
  stripeRequest<StripeSubscription>(env, "POST", `/subscriptions/${subscriptionId}`, { cancel_at_period_end: false });

export const listInvoices = (env: Env, customerId: string, limit = 20) =>
  stripeRequest<{ data: Record<string, unknown>[] }>(env, "GET", `/invoices?customer=${encodeURIComponent(customerId)}&limit=${limit}`);

/**
 * Verifies the `Stripe-Signature` header (scheme v1, HMAC-SHA256 over `t.payload`).
 * Tolerance defaults to five minutes to blunt replay attacks.
 */
export async function verifyWebhookSignature(secret: string, payload: string, header: string | null, toleranceSeconds = 300): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  ) as { t?: string; v1?: string };
  if (!parts.t || !parts.v1) return false;
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) return false;
  const expected = await hmacSha256Hex(secret, `${parts.t}.${payload}`);
  return timingSafeEqual(expected, parts.v1);
}
