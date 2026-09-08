import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { ArrowRight, Target, Eye, HeartHandshake } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Your files stay yours",
    text: "CloudGather indexes metadata so you can work across providers — we never move, copy or mine your content.",
  },
  {
    icon: Eye,
    title: "Transparency first",
    text: "This page, our privacy policy and our public roadmap say what we actually do. No dark patterns, no surprise data brokering.",
  },
  {
    icon: HeartHandshake,
    title: "Calm software",
    text: "Storage is a solved problem; attention is not. We build tools that reduce tabs and anxiety, not add to them.",
  },
];

const AboutPage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title="About"
        description="Why we built CloudGather: one calm, private workspace for files scattered across Google Drive, Dropbox, OneDrive, Box and more."
        path="/about"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])]}
      />

      <section className="border-b bg-dotted" aria-labelledby="about-hero">
        <div className="container px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 id="about-hero" className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight sm:text-5xl">
            We got tired of playing <span className="text-gradient">"which drive was it in?"</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Between work accounts, personal accounts and the occasional S3 bucket, most people's
            files live in four or more places. {siteConfig.name} exists to end that scatter —
            one login, one search box, every file.
          </p>
        </div>
      </section>

      <section className="container px-4 py-16 sm:px-6" aria-labelledby="values-heading">
        <h2 id="values-heading" className="text-center text-3xl font-bold tracking-tight">
          What we believe
        </h2>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
          {values.map((value) => (
            <div key={value.title} className="flex flex-col gap-3 rounded-xl border bg-card p-6">
              <value.icon className="h-5 w-5 text-accent" aria-hidden="true" />
              <h3 className="font-semibold">{value.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{value.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/30" aria-labelledby="story-heading">
        <div className="container max-w-3xl px-4 py-16 sm:px-6">
          <h2 id="story-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            The short version
          </h2>
          <div className="mt-6 space-y-4 text-muted-foreground">
            <p>
              CloudGather started as an internal tool: a script that listed files across
              several drives so one person could find one invoice. That script became a
              product when it became obvious how many people live the same problem —
              documents in Google Drive, design assets in Dropbox, backups in S3,
              photos everywhere.
            </p>
            <p>
              Today CloudGather is an open-beta web app. It connects to the providers you
              already use, gives you one place to browse, search, organize and share, and
              exposes a small, honest API for developers. It is deliberately not a sync
              client and not a migration tool — your files stay put.
            </p>
            <p>
              We're a small, independent team. That means we move carefully, we don't
              have an ads business, and your data funds nothing but the product.
            </p>
          </div>
        </div>
      </section>

      <section className="container px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-bold">Come gather your clouds</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Free while in open beta — we'd love your feedback on what to build next.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link to="/register">
              Create free account <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/contact">Contact us</Link>
          </Button>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default AboutPage;
