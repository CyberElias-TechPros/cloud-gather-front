import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";
import { Check, Minus, ArrowRight } from "lucide-react";

const pricingFaqs = [
  {
    q: "Is CloudGather really free?",
    a: "Yes — during the open beta every feature, including provider connections and the developer API, is free. When paid plans launch, existing beta users keep a generous free tier.",
  },
  {
    q: "Do you charge based on how much storage I have?",
    a: "No. Your files stay in your own provider accounts, so we don't store (or charge for) your data. Plans are based on features, not bytes.",
  },
  {
    q: "What will paid plans include?",
    a: "Team collaboration (shared workspaces and roles), audit-ready activity logs, priority support and higher API rate limits.",
  },
  {
    q: "Can I cancel or disconnect anytime?",
    a: "Always. Disconnecting a provider immediately removes its stored tokens. Deleting your account removes all associated data.",
  },
];

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "during open beta",
    description: "Everything you need to gather your personal clouds.",
    cta: "Get started free",
    href: "/register",
    highlight: true,
    features: [
      { label: "Unlimited provider connections", included: true },
      { label: "Unified search & file management", included: true },
      { label: "File sharing with expiry", included: true },
      { label: "Developer API keys", included: true },
      { label: "Community support", included: true },
      { label: "Team workspaces", included: false },
      { label: "Priority support", included: false },
    ],
  },
  {
    name: "Team",
    price: "TBA",
    period: "planned",
    description: "Shared workspaces and controls for small teams.",
    cta: "Join the waitlist",
    href: "/contact",
    highlight: false,
    features: [
      { label: "Everything in Free", included: true },
      { label: "Team workspaces & roles", included: true },
      { label: "Audit-ready activity logs", included: true },
      { label: "Higher API rate limits", included: true },
      { label: "Priority support", included: true },
      { label: "SSO / SAML", included: false },
    ],
  },
];

const PricingPage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title="Pricing"
        description="CloudGather is free during the open beta. No credit card, no storage fees — your files stay in your own accounts."
        path="/pricing"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Pricing", path: "/pricing" }]), faqJsonLd(pricingFaqs)]}
      />

      <section className="border-b bg-dotted" aria-labelledby="pricing-hero">
        <div className="container px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 id="pricing-hero" className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Simple, honest pricing
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Your files already live in accounts you pay for (or got free). We charge for the
            gathering, never for the bytes.
          </p>
        </div>
      </section>

      <section className="container px-4 py-16 sm:px-6" aria-label="Plans">
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${plan.highlight ? "border-primary shadow-lg shadow-primary/10" : ""}`}
            >
              {plan.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full">Most popular</Badge>
              )}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <div className="mt-2">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="ml-1 text-sm text-muted-foreground">/ {plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2.5 text-sm">
                      {feature.included ? (
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Included" />
                      ) : (
                        <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50" aria-label="Not included" />
                      )}
                      <span className={feature.included ? "" : "text-muted-foreground"}>{feature.label}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={plan.highlight ? "default" : "outline"} asChild>
                  <Link to={plan.href}>
                    {plan.cta} <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t bg-muted/30" aria-labelledby="pricing-faq">
        <div className="container max-w-3xl px-4 py-16 sm:px-6">
          <h2 id="pricing-faq" className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Pricing questions
          </h2>
          <Accordion type="single" collapsible className="mt-8">
            {pricingFaqs.map((faq, i) => (
              <AccordionItem key={faq.q} value={`pfaq-${i}`}>
                <AccordionTrigger className="text-left font-medium">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default PricingPage;
