import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { PROVIDERS } from "@/lib/providers";
import {
  Search,
  FolderTree,
  Share2,
  Upload,
  HardDrive,
  KeyRound,
  Clock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: FolderTree,
    title: "One file tree for every account",
    text: "Browse all connected providers from a single file explorer. Create folders, rename, star and delete without switching apps.",
  },
  {
    icon: Search,
    title: "Search across everything",
    text: "Type once, search everywhere. Results come back from every connected drive, sorted the way you expect.",
  },
  {
    icon: Upload,
    title: "Uploads with real progress",
    text: "Drag a file onto your workspace and watch byte-accurate upload progress. Files land in your CloudGather storage, catalogued and searchable.",
  },
  {
    icon: Share2,
    title: "Sharing that expires",
    text: "Share any file by email with view or edit permission, an optional expiry date, and a full record of who has access.",
  },
  {
    icon: HardDrive,
    title: "Storage overview",
    text: "Quota and usage per provider, plus a breakdown of your storage by file type — spot the nearly-full drive before it blocks your work.",
  },
  {
    icon: Clock,
    title: "Recents",
    text: "The files you touched most recently, in one place, no matter which provider they live in.",
  },
  {
    icon: KeyRound,
    title: "Developer API & keys",
    text: "Create scoped API keys to list, upload, download and share files from scripts and automations.",
  },
  {
    icon: ShieldCheck,
    title: "Security by isolation",
    text: "Provider tokens are stored server-side. Row-level security means every account only ever sees its own data.",
  },
];

const FeaturesPage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title="Features"
        description="Unified cloud storage management: one file tree, cross-provider search, sharing with expiry, storage overview and a developer API."
        path="/features"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Features", path: "/features" }])]}
      />

      <section className="border-b bg-dotted" aria-labelledby="features-hero">
        <div className="container px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 id="features-hero" className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            Everything your files can do, <span className="text-gradient">together</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            CloudGather treats your scattered storage accounts as one workspace —
            here is exactly what that means.
          </p>
        </div>
      </section>

      <section className="container px-4 py-16 sm:px-6" aria-label="Feature list">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2">
          {features.map((feature) => (
            <Card key={feature.title} className="card-hover border-border/70">
              <CardContent className="flex h-full flex-col gap-3 p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </span>
                <h2 className="text-lg font-semibold">{feature.title}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{feature.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section id="providers" className="border-y bg-muted/30" aria-labelledby="providers-heading">
        <div className="container px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="providers-heading" className="text-3xl font-bold tracking-tight">
              Supported providers
            </h2>
            <p className="mt-4 text-muted-foreground">
              OAuth providers authorize in one click. Key-based providers (S3-compatible services)
              connect with credentials you generate in their console.
            </p>
          </div>
          <ul className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <li key={provider.id} className="flex items-start gap-3 rounded-xl border bg-card p-4">
                <provider.icon className={`mt-0.5 h-6 w-6 shrink-0 ${provider.color}`} aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-semibold">
                    {provider.name}
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {provider.kind === "oauth" ? "OAuth" : "API key"}
                    </span>
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{provider.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold">Ready to gather your clouds?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Free while in open beta — connect your first provider in about two minutes.
        </p>
        <Button size="lg" className="mt-6" asChild>
          <Link to="/register">
            Get started free <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </MarketingLayout>
  );
};

export default FeaturesPage;
