import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo } from "@/components/common/Seo";
import { organizationJsonLd, webSiteJsonLd, softwareAppJsonLd, faqJsonLd } from "@/lib/seo";
import { PROVIDERS } from "@/lib/providers";
import { siteConfig } from "@/lib/site";
import {
  ArrowRight,
  Search,
  Share2,
  ShieldCheck,
  Upload,
  Layers,
  KeyRound,
  Check,
  X,
} from "lucide-react";

const faqs = [
  {
    q: "What is CloudGather?",
    a: "CloudGather is a unified cloud storage manager. You connect the storage accounts you already use — Google Drive, Dropbox, OneDrive, Box, S3-compatible buckets and more — and browse, search, organize and share everything from a single dashboard.",
  },
  {
    q: "Does CloudGather move or copy my files?",
    a: "No. CloudGather indexes metadata (names, sizes, folder structure) so you can see and organize everything in one place. Your files stay with their original provider unless you explicitly choose to act on them.",
  },
  {
    q: "Is CloudGather free?",
    a: "Yes — the core plan is free while we're in open beta, including unlimited provider connections and the developer API. Paid plans add team collaboration and priority support as those features roll out.",
  },
  {
    q: "How do I connect my Google Drive or Dropbox account?",
    a: "Sign up, open Providers, and click Connect. For OAuth providers you authorize CloudGather once with the provider itself; for S3-compatible services you paste an access key. You can disconnect any provider at any time.",
  },
  {
    q: "Can developers integrate with CloudGather?",
    a: "Yes. The CloudGather REST API lets you list, upload, download and share files programmatically using personal API keys. See the Developers page for endpoints and examples.",
  },
  {
    q: "What happens to my provider tokens?",
    a: "Access and refresh tokens are stored server-side, scoped to your account, and are only used to serve your own requests. Disconnecting a provider deletes its stored tokens. We never sell data or use your files for anything other than serving you.",
  },
];

const HomePage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title={siteConfig.name}
        description={siteConfig.description}
        path="/"
        jsonLd={[organizationJsonLd(), webSiteJsonLd(), softwareAppJsonLd(), faqJsonLd(faqs)]}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b bg-dotted" aria-labelledby="hero-heading">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent"
          aria-hidden="true"
        />
        <div className="container relative flex flex-col items-center px-4 py-20 text-center sm:px-6 lg:py-28">
          <Badge variant="secondary" className="mb-5 gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Open beta — free while in development
          </Badge>

          <h1 id="hero-heading" className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            One home for <span className="text-gradient">every cloud</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Connect Google Drive, Dropbox, OneDrive, Box, S3 and more. Browse, search,
            organize and share all of your files from a single dashboard — without
            moving a single byte out of your accounts.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link to="/register">
                Get started free <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/features">See how it works</Link>
            </Button>
          </div>

          {/* Provider wall — shows the actual supported services */}
          <ul className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-4" aria-label="Supported storage providers">
            {PROVIDERS.slice(0, 7).map((provider) => (
              <li key={provider.id} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <provider.icon className={`h-5 w-5 ${provider.color}`} aria-hidden="true" />
                {provider.name}
              </li>
            ))}
            <li className="text-sm font-medium text-muted-foreground">+ more</li>
          </ul>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="container px-4 py-20 sm:px-6" aria-labelledby="how-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="how-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Your storage, gathered in minutes
          </h2>
          <p className="mt-4 text-muted-foreground">
            No migration projects, no sync clients to babysit. Three steps and every file
            you own is one search away.
          </p>
        </div>

        <ol className="mx-auto mt-14 grid max-w-5xl gap-8 md:grid-cols-3">
          {[
            {
              icon: Layers,
              title: "1. Connect accounts",
              text: "Authorize each provider once. CloudGather stores tokens server-side, scoped to your account — revoke anytime.",
            },
            {
              icon: Search,
              title: "2. See everything",
              text: "Every file and folder appears in one tree with unified search, sorting and a live storage overview across providers.",
            },
            {
              icon: Share2,
              title: "3. Organize & share",
              text: "Star what matters, rename and tidy up, then share any file with an email and an optional expiry date.",
            },
          ].map((step) => (
            <li key={step.title}>
              <Card className="card-hover h-full border-border/70">
                <CardContent className="flex h-full flex-col gap-3 p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </span>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Feature highlights ───────────────────────────────────────────── */}
      <section className="border-y bg-muted/30" aria-labelledby="features-heading">
        <div className="container px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="features-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for people with more than one cloud
            </h2>
            <p className="mt-4 text-muted-foreground">
              Freelancers, small teams and anyone whose work ended up scattered across
              drives. <Link to="/features" className="font-medium text-primary underline-offset-2 hover:underline">See all features →</Link>
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Search, title: "Unified search", text: "One search box across every connected provider — no more checking four apps to find one file." },
              { icon: Upload, title: "Upload anywhere", text: "Upload straight into your CloudGather workspace with drag-and-drop and real upload progress." },
              { icon: Share2, title: "Sharing with expiry", text: "Share files by email with view or edit access, and set an automatic expiry date." },
              { icon: ShieldCheck, title: "Tokens stay server-side", text: "Provider credentials never touch your browser. Row-level security isolates every account." },
              { icon: KeyRound, title: "Developer API", text: "Personal API keys with scoped permissions for scripts, automations and integrations." },
              { icon: Layers, title: "Storage overview", text: "See quotas and usage per provider at a glance, and spot nearly-full drives before they cause problems." },
            ].map((feature) => (
              <div key={feature.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
                <feature.icon className="h-5 w-5 text-accent" aria-hidden="true" />
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Comparison ───────────────────────────────────────────────────── */}
      <section className="container px-4 py-20 sm:px-6" aria-labelledby="compare-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="compare-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
            Why gather instead of juggling tabs?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Each provider app is great at its own files. CloudGather is great at all of them.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Comparison of using individual provider apps vs. CloudGather</caption>
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th scope="col" className="px-5 py-3.5 font-semibold">Capability</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">One provider app</th>
                <th scope="col" className="px-5 py-3.5 font-semibold text-primary">CloudGather</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["See files from every provider", false, true],
                ["One search across all accounts", false, true],
                ["Unified storage overview", false, true],
                ["Share across providers with expiry", false, true],
                ["Files stay with original provider", true, true],
                ["Full native provider features (offline, sync apps)", true, false],
              ].map(([label, providerApp, cloudGather]) => (
                <tr key={String(label)} className="border-b last:border-0">
                  <th scope="row" className="px-5 py-3.5 text-left font-normal">{label}</th>
                  <td className="px-5 py-3.5">
                    {providerApp ? (
                      <Check className="h-4 w-4 text-success" aria-label="Yes" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50" aria-label="No" />
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {cloudGather ? (
                      <Check className="h-4 w-4 text-success" aria-label="Yes" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/50" aria-label="No" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-4 max-w-4xl text-xs text-muted-foreground">
          CloudGather complements — it doesn&apos;t replace — native provider apps. Continue using sync clients
          and provider-specific features; gather them all in one view.
        </p>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="border-t bg-muted/30" aria-labelledby="faq-heading">
        <div className="container max-w-3xl px-4 py-20 sm:px-6">
          <h2 id="faq-heading" className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently asked questions
          </h2>
          <Accordion type="single" collapsible className="mt-10">
            {faqs.map((faq, i) => (
              <AccordionItem key={faq.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-base font-medium">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="container px-4 py-20 sm:px-6" aria-labelledby="cta-heading">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-[hsl(191_80%_38%)] px-6 py-16 text-center text-primary-foreground shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-dotted opacity-20" aria-hidden="true" />
          <h2 id="cta-heading" className="relative text-3xl font-bold tracking-tight sm:text-4xl">
            Gather your clouds today
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-primary-foreground/90">
            Free while in open beta. No credit card. Disconnect any provider whenever you like.
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">
                Create free account <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/contact">Talk to us</Link>
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default HomePage;
