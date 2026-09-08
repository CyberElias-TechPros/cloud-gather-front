import React from "react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. Who we are",
    body: (
      <>
        <p>
          {siteConfig.name} (&quot;CloudGather&quot;, &quot;we&quot;) operates a web application that lets you view and
          organize files stored in third-party cloud storage services you connect (for example Google
          Drive, Dropbox, OneDrive and Box). This policy explains what personal data we handle and why.
        </p>
        <p>
          This document is provided as a practical summary of our data practices. It is not legal advice;
          have it reviewed by counsel before relying on it as your organization&apos;s privacy policy.
        </p>
      </>
    ),
  },
  {
    title: "2. Data we process",
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Account data.</strong> Email address, optional display name and avatar, authentication credentials managed by our auth provider.</li>
          <li><strong>Provider connections.</strong> For each cloud service you connect: the provider name, your email at that provider, and OAuth access/refresh tokens or API credentials. These are stored server-side, encrypted in transit, and used only to serve your requests.</li>
          <li><strong>File metadata.</strong> File names, sizes, MIME types and folder structure of the files you browse or upload, so the product can show them to you. We do not index or read file contents except to serve your own download/preview requests.</li>
          <li><strong>Files you upload to CloudGather storage.</strong> Stored in private cloud object storage scoped to your account.</li>
          <li><strong>Activity logs.</strong> Records of actions like uploads, shares and deletions, used to power your dashboard and for security auditing.</li>
          <li><strong>Shares.</strong> When you share a file with someone, we store their email address and the permission level you granted.</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. What we do NOT do",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>We do not sell personal data. There is no ads business.</li>
        <li>We do not read, analyze or train on your file contents.</li>
        <li>We do not access your connected accounts except to serve requests you initiate.</li>
        <li>We do not require access to providers beyond the minimum scopes needed to list and read files.</li>
      </ul>
    ),
  },
  {
    title: "4. Legal bases (GDPR)",
    body: (
      <p>
        Where the GDPR applies, we process account and connection data to perform our contract with you
        (Art. 6(1)(b)), activity and security logs under our legitimate interest in operating a secure
        service (Art. 6(1)(f)), and any optional communications with your consent (Art. 6(1)(a)).
      </p>
    ),
  },
  {
    title: "5. Retention & deletion",
    body: (
      <p>
        You can disconnect a provider at any time, which immediately deletes its stored tokens. You can
        delete your account from Settings → Data, which deletes your files, metadata, shares, API keys and
        activity logs. Some security logs may be retained in aggregate for fraud/abuse prevention. Expired
        share links stop working immediately after expiry.
      </p>
    ),
  },
  {
    title: "6. Subprocessors",
    body: (
      <p>
        We rely on a small set of infrastructure providers: a cloud host for the application and its
        database/storage, an authentication provider, and the third-party storage services you choose to
        connect. Each subprocessor is bound by data-processing terms.
      </p>
    ),
  },
  {
    title: "7. Your rights",
    body: (
      <p>
        Depending on your location you may have rights to access, correct, export or delete your personal
        data. In-product controls cover most requests (account deletion exports nothing by default — use
        Settings → Data → Export first). For anything else, contact {siteConfig.supportEmail}.
      </p>
    ),
  },
  {
    title: "8. Cookies",
    body: (
      <p>
        CloudGather uses only strictly necessary cookies/local storage for authentication sessions. We do
        not use advertising or cross-site tracking cookies.
      </p>
    ),
  },
  {
    title: "9. Changes & contact",
    body: (
      <p>
        If we change this policy materially we will notify you in the product and update the date below.
        Questions: {siteConfig.supportEmail}.
      </p>
    ),
  },
];

const PrivacyPage: React.FC = () => {
  return (
    <MarketingLayout>
      <Seo
        title="Privacy policy"
        description="What data CloudGather processes, what we never do with it, and how to delete it."
        path="/privacy"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Privacy policy", path: "/privacy" }])]}
      />
      <section className="border-b bg-dotted">
        <div className="container px-4 py-14 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">Privacy policy</h1>
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

export default PrivacyPage;
