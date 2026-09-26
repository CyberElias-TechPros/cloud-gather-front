import { api } from "@/lib/api";
import type { Entitlements, Invoice, Plan, Subscription } from "@/types/api";

export interface PlansResponse {
  plans: (Plan & { price_ids: { monthly: boolean; yearly: boolean }; purchasable: boolean })[];
  billing_enabled: boolean;
  currency: string;
}

export const getPlans = () => api<PlansResponse>("/billing/plans");

export interface SubscriptionResponse extends Omit<Entitlements, "storage_percent"> {
  storage_percent: number;
  subscription: Subscription | null;
  invoices: Invoice[];
  billing_enabled: boolean;
}

export const getSubscription = () => api<SubscriptionResponse>("/billing/subscription");

export const startCheckout = (plan: string, interval: "monthly" | "yearly" = "monthly") =>
  api<{ url: string; session_id: string }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan, interval }),
  });

export const openPortal = () => api<{ url: string }>("/billing/portal", { method: "POST" });

export const cancelSubscription = () => api<{ ok: boolean; cancel_at: string | null }>("/billing/cancel", { method: "POST" });

export const resumeSubscription = () => api<{ ok: boolean }>("/billing/resume", { method: "POST" });

export const refreshInvoices = () => api<{ invoices: Invoice[] }>("/billing/invoices/refresh", { method: "POST" });
