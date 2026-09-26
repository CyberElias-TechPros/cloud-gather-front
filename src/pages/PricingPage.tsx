import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuth } from "@/contexts/AuthContext";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Check, Minus, ArrowRight } from "lucide-react";
import type { Plan } from "@/types/api";

const pricingFaqs = [
  {
    q: "Can I start for free?",
    a: "Yes. The Free plan includes unified search, sharing and the developer API with no card required. Upgrade only when you need more storage or seats.",
  },
  {
    q: "Do you charge for files that stay in my own cloud accounts?",
    a: "No. Files that live in a connected provider are indexed, not copied, so they don't count toward your CloudGather storage allowance.",
  },
  {
    q: "Can I change plan later?",
    a: "Any time. Upgrades apply immediately and downgrades take effect at the end of the billing period — we never delete files, they just become read-only if you exceed the smaller plan.",
  },
  {
    q: "What happens if I cancel?",
    a: "You keep access until the end of the period, then move to the Free plan. You can export everything at any point from Settings → Data & privacy.",
  },
];

/** Cents → display price. `-1` marks a plan that is quoted, not self-served. */
const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);

const LIMIT_ROWS: { label: string; render: (plan: Plan) => string }[] = [
  { label: "Managed storage", render: (plan) => formatBytes(plan.limits.storageBytes) },
  { label: "Max upload size", render: (plan) => formatBytes(plan.limits.maxFileSizeBytes) },
  { label: "Connected drives", render: (plan) => String(plan.limits.maxProviders) },
  { label: "Team seats", render: (plan) => String(plan.limits.seats) },
  { label: "Version history", render: (plan) => `${plan.limits.versionHistory} versions` },
  { label: "Public links", render: (plan) => String(plan.limits.maxPublicLinks) },
  { label: "API keys", render: (plan) => String(plan.limits.maxApiKeys) },
  { label: "Webhooks", render: (plan) => (plan.limits.maxWebhooks > 0 ? String(plan.limits.maxWebhooks) : "—") },
  { label: "API rate limit", render: (plan) => `${plan.limits.apiRateLimitPerMinute}/min` },
  { label: "Trash retention", render: (plan) => `${plan.limits.trashRetentionDays} days` },
];

const PricingPage: React.FC = () => {
  const { data: config, isLoading } = useAppConfig();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [interval, setInterval] = React.useState<"monthly" | "yearly">("monthly");

  const plans = config?.plans ?? [];
  const purchasable = new Set(config?.purchasable_plans ?? []);

  const choose = (plan: Plan) => {
    if (plan.priceMonthly < 0) return navigate("/contact");
    if (!user) return navigate(`/register?plan=${plan.id}`);
    if (plan.priceMonthly === 0) return navigate("/dashboard");
    // Checkout itself lives on /billing, which knows the active subscription.
    navigate(purchasable.has(plan.id) ? "/billing" : "/contact");
  };

  const ctaLabel = (plan: Plan) => {
    if (plan.priceMonthly < 0) return "Talk to sales";
    if (plan.priceMonthly === 0) return "Get started free";
    return `Choose ${plan.name}`;
  };

  return (
    <MarketingLayout>
      <Seo
        title="Pricing"
        description="Simple plans for individuals and teams. Start free, upgrade when you need more storage or seats."
        path="/pricing"
        jsonLd={[
          breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]),
          faqJsonLd(pricingFaqs),
        ]}
      />

      <section className="border-b bg-dotted">
        <div className="container px-4 py-16 text-center sm:px-6 lg:py-20">
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Pricing that scales with you</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Every plan includes unified search, sharing and the developer API. Your provider files stay in your own
            accounts — you only pay for managed storage and team features.
          </p>
          <div className="mt-8 inline-flex rounded-lg border bg-background p-1">
            {(["monthly", "yearly"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setInterval(value)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors",
                  interval === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {value}
                {value === "yearly" ? <span className="ml-1.5 text-xs opacity-80">2 months free</span> : null}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="container px-4 py-14 sm:px-6">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-96 w-full rounded-xl" />)
            : plans.map((plan) => {
                const price = interval === "yearly" ? plan.priceYearly : plan.priceMonthly;
                return (
                  <Card key={plan.id} className={cn("flex flex-col", plan.popular && "border-primary shadow-md")}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        {plan.popular ? <Badge>Most popular</Badge> : null}
                      </div>
                      <CardDescription>{plan.tagline}</CardDescription>
                      <p className="pt-3 text-4xl font-bold">
                        {price < 0 ? "Custom" : price === 0 ? "Free" : money(price, plan.currency)}
                        {price > 0 ? (
                          <span className="text-base font-normal text-muted-foreground">
                            /{interval === "yearly" ? "year" : "month"}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ul className="space-y-2.5 text-sm">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => choose(plan)}
                      >
                        {ctaLabel(plan)}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
        </div>
      </section>

      {/* Comparison table */}
      {plans.length > 0 ? (
        <section className="container px-4 pb-16 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Compare plans</h2>
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Limit</TableHead>
                  {plans.map((plan) => (
                    <TableHead key={plan.id} className="text-center">
                      {plan.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {LIMIT_ROWS.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    {plans.map((plan) => (
                      <TableCell key={plan.id} className="text-center text-sm">
                        {row.render(plan)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-medium">Capabilities</TableCell>
                  {plans.map((plan) => (
                    <TableCell key={plan.id} className="text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {plan.capabilities.length === 0 ? (
                          <Minus className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          plan.capabilities.map((capability) => (
                            <Badge key={capability} variant="outline" className="text-[10px]">
                              {capability.replace(/_/g, " ")}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      ) : null}

      <section className="border-t bg-muted/30">
        <div className="container max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="mb-6 text-2xl font-bold tracking-tight">Frequently asked questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {pricingFaqs.map((faq, index) => (
              <AccordionItem key={faq.q} value={`item-${index}`}>
                <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Still deciding?{" "}
            <Link to="/contact" className="text-primary underline-offset-2 hover:underline">
              Talk to us
            </Link>{" "}
            — we&apos;ll help you pick.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default PricingPage;
