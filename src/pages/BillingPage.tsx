import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CreditCard,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  cancelSubscription,
  getPlans,
  getSubscription,
  openPortal,
  refreshInvoices,
  resumeSubscription,
  startCheckout,
} from "@/services/billing";
import { formatBytes, formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(
    cents / 100,
  );

/** Plan, usage against entitlements, upgrade/downgrade and invoice history. */
const BillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [interval, setInterval] = React.useState<"monthly" | "yearly">("monthly");
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [pendingPlan, setPendingPlan] = React.useState<string | null>(null);

  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: getPlans });
  const subscription = useQuery({ queryKey: ["billing", "subscription"], queryFn: getSubscription });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["billing"] });

  const checkout = useMutation({
    mutationFn: (plan: string) => startCheckout(plan, interval),
    onMutate: (plan) => setPendingPlan(plan),
    onSuccess: (data) => {
      if (data.url) window.location.assign(data.url);
      else toast.error("Checkout is not available yet.");
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => setPendingPlan(null),
  });

  const portal = useMutation({
    mutationFn: openPortal,
    onSuccess: (data) => window.location.assign(data.url),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const cancel = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (data) => {
      toast.success(data.cancel_at ? `Your plan ends ${formatDate(data.cancel_at)}` : "Subscription cancelled");
      setConfirmCancel(false);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resume = useMutation({
    mutationFn: resumeSubscription,
    onSuccess: () => {
      toast.success("Subscription resumed");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const syncInvoices = useMutation({
    mutationFn: refreshInvoices,
    onSuccess: () => {
      toast.success("Invoices up to date");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const current = subscription.data;
  const billingEnabled = current?.billing_enabled ?? plans.data?.billing_enabled ?? false;
  const usage = current?.usage;
  const limits = current?.limits;
  const currentPlanId = current?.plan?.id ?? "free";
  const sub = current?.subscription;

  return (
    <div className="space-y-6">
      <Seo title="Plan & billing" description="Manage your CloudGather subscription." path="/billing" noIndex />
      <PageHeader
        title="Plan & billing"
        icon={CreditCard}
        description="Your subscription, usage and invoices."
        actions={
          billingEnabled && sub ? (
            <Button variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
              {portal.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Billing portal
            </Button>
          ) : undefined
        }
      />

      {!billingEnabled ? (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Self-serve billing is not enabled on this deployment</AlertTitle>
          <AlertDescription>
            Plan limits still apply. <Link className="underline" to="/contact">Contact us</Link> to change your plan.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Current plan + usage */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                {subscription.isLoading ? <Skeleton className="h-6 w-24" /> : current?.plan?.name ?? "Free"} plan
                {sub?.status && sub.status !== "active" ? (
                  <Badge variant="outline" className="capitalize">{sub.status}</Badge>
                ) : null}
              </CardTitle>
              <CardDescription>
                {sub?.current_period_end
                  ? sub.cancel_at_period_end
                    ? `Ends on ${formatDate(sub.current_period_end)}`
                    : `Renews on ${formatDate(sub.current_period_end)} · billed ${sub.interval}`
                  : "No paid subscription — you're on the free tier."}
              </CardDescription>
            </div>
            {sub?.cancel_at_period_end ? (
              <Button variant="outline" onClick={() => resume.mutate()} disabled={resume.isPending}>
                {resume.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Resume subscription
              </Button>
            ) : sub ? (
              <Button variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)}>
                Cancel plan
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {subscription.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Storage</span>
                  <span className="text-muted-foreground">
                    {formatBytes(usage?.storageBytes ?? 0)} of {formatBytes(limits?.storageBytes ?? 0)}
                  </span>
                </div>
                <Progress value={Math.min(current?.storage_percent ?? 0, 100)} className="h-2" />
              </div>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Files", value: `${usage?.fileCount ?? 0}` },
                  { label: "Connected drives", value: `${usage?.providerCount ?? 0} / ${limits?.maxProviders ?? 0}` },
                  { label: "API keys", value: `${usage?.apiKeyCount ?? 0} / ${limits?.maxApiKeys ?? 0}` },
                  { label: "Public links", value: `${usage?.publicLinkCount ?? 0} / ${limits?.maxPublicLinks ?? 0}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border p-3">
                    <dt className="text-xs text-muted-foreground">{item.label}</dt>
                    <dd className="text-lg font-semibold">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      {/* Plan picker */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Available plans</h2>
          <div className="inline-flex rounded-lg border p-1">
            {(["monthly", "yearly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setInterval(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                  interval === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
                {value === "yearly" ? <span className="ml-1 text-xs opacity-80">save 20%</span> : null}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.isLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-80 w-full rounded-xl" />)
            : plans.data?.plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const price = interval === "yearly" ? plan.priceYearly : plan.priceMonthly;
                return (
                  <Card key={plan.id} className={cn("flex flex-col", plan.popular && "border-primary shadow-sm")}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {isCurrent ? <Badge>Current</Badge> : plan.popular ? <Badge variant="secondary">Popular</Badge> : null}
                      </div>
                      <CardDescription>{plan.tagline}</CardDescription>
                      <p className="pt-2 text-3xl font-bold">
                        {price < 0 ? "Custom" : price === 0 ? "Free" : money(price, plan.currency || plans.data?.currency)}
                        {price > 0 ? (
                          <span className="text-sm font-normal text-muted-foreground">/{interval === "yearly" ? "yr" : "mo"}</span>
                        ) : null}
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2 text-sm">
                        {plan.features.slice(0, 6).map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      {isCurrent ? (
                        <Button variant="outline" className="w-full" disabled>
                          Your plan
                        </Button>
                      ) : !plan.purchasable ? (
                        <Button variant="outline" className="w-full" asChild>
                          <Link to="/contact">
                            {plan.priceMonthly < 0 ? "Talk to sales" : "Contact us"} <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          className="w-full"
                          disabled={!billingEnabled || checkout.isPending}
                          onClick={() => checkout.mutate(plan.id)}
                        >
                          {pendingPlan === plan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          {`Choose ${plan.name}`}
                        </Button>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
        </div>
      </section>

      {/* Invoices */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Invoices</CardTitle>
            <CardDescription>Receipts for every payment on this account.</CardDescription>
          </div>
          {billingEnabled ? (
            <Button variant="ghost" size="sm" onClick={() => syncInvoices.mutate()} disabled={syncInvoices.isPending}>
              <RefreshCw className={cn("mr-2 h-4 w-4", syncInvoices.isPending && "animate-spin")} /> Refresh
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {(current?.invoices?.length ?? 0) === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current?.invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.number ?? invoice.id.slice(0, 12)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(invoice.created_at)}</TableCell>
                    <TableCell>{money(invoice.amount_paid, invoice.currency)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.status === "paid" ? "secondary" : "outline"} className="capitalize">
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {invoice.invoice_pdf || invoice.hosted_invoice_url ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={invoice.invoice_pdf || invoice.hosted_invoice_url || "#"} target="_blank" rel="noreferrer">
                            <Download className="mr-2 h-4 w-4" /> PDF
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {subscription.isError ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Billing information unavailable</AlertTitle>
          <AlertDescription>{errorMessage(subscription.error)}</AlertDescription>
        </Alert>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Cancel your subscription?"
        description="You'll keep your current plan until the end of the billing period, then move to the Free plan. Files above the free limit become read-only."
        confirmLabel="Cancel plan"
        cancelLabel="Keep plan"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
    </div>
  );
};

export default BillingPage;
