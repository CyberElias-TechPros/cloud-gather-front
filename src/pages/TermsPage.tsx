import React from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Agreement",
    body: (
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of {siteConfig.name}. By creating an account or
        using the service you agree to these Terms. If you use CloudGather on behalf of an organization,
        you represent that you have authority to bind that organization.
      </p>
    ),
  },
  {
    title: "2. The service",
    body: (
      <p>
        CloudGather is a management layer for cloud storage services you connect. We display metadata and,
        where you request it, file contents from those services. Files remain in — and remain governed
        by — the terms of the provider that stores them. We are not affiliated with, endorsed by, or
        sponsored by any storage provider; provider names and trademarks belong to their owners.
      </p>
    ),
  },
  {
    title: "3. Your responsibilities",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Keep your credentials secure and tell us promptly about unauthorized use.</li>
        <li>Only connect accounts you are authorized to use.</li>
        <li>Do not use CloudGather to store or distribute unlawful, infringing or malicious content.</li>
        <li>Do not attempt to access other users&apos; data, overload the service, or reverse-engineer protections beyond what the law allows.</li>
        <li>Comply with the developer API rate limits and use API keys only for your own integrations.</li>
      </ul>
    ),
  },
  {
    title: "4. Account termination",
    body: (
      <p>
        You may delete your account at any time from Settings. We may suspend or terminate accounts that
        violate these Terms, create security risk, or remain inactive for an extended period after notice.
      </p>
    ),
  },
  {
    title: "5. Pricing & availability",
    body: (
      <p>
        CloudGather is free during the open beta. If we introduce paid plans we will announce pricing in
        advance and this section will describe billing, renewal and refund terms. The service is provided
        during beta &quot;as is&quot; and may change or be interrupted as we develop it.
      </p>
    ),
  },
  {
    title: "6. Disclaimers & limitation of liability",
    body: (
      <p>
        Except where prohibited by law, CloudGather is provided without warranties of any kind, express or
        implied. To the maximum extent permitted by law, our aggregate liability arising out of or relating
        to the service is limited to the greater of amounts you paid us in the 12 months before the claim
        or USD 50. We are not liable for indirect, incidental, special or consequential damages, or for the
        acts of third-party providers whose services you connect.
      </p>
    ),
  },
  {
    title: "7. Changes to these Terms",
    body: (
      <p>
        We may update these Terms as the product evolves. Material changes will be announced in the product
        at least 14 days before they take effect. Continuing to use CloudGather after that constitutes
        acceptance.
      </p>
    ),
  },
  {
    title: "8. Contact",
    body: <p>Questions about these Terms: {siteConfig.supportEmail}.</p>,
  },
];

const TermsPage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title="Terms of service"
        description="The rules for using CloudGather: your account, your responsibilities, and ours."
        path="/terms"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Terms of service", path: "/terms" }])]}
      />
      <section className="border-b bg-dotted">
        <div className="container px-4 py-14 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Terms of service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: September 7, 2026</p>
        </div>
      </section>
      <section className="container max-w-3xl px-4 py-12 sm:px-6">
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{section.body}</div>
            </div>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
};

export default TermsPage;
