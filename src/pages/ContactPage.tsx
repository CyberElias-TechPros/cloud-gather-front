import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { Loader2, Mail, Bug, BookOpen, ExternalLink } from "lucide-react";

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const ContactPage: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [opening, setOpening] = useState(false);

  /** The support channel is email; we compose the message in the user's own
   * mail client so nothing is stored or lost in a black-hole form. */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Please tell us your name.";
    if (!emailOk(email)) nextErrors.email = "Enter a valid email address.";
    if (!subject.trim()) nextErrors.subject = "Add a short subject.";
    if (message.trim().length < 10) nextErrors.message = "Please describe your question (at least 10 characters).";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const body = encodeURIComponent(`${message.trim()}\n\n— ${name.trim()} (${email.trim()})`);
    const mailto = `mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent(`[CloudGather] ${subject.trim()}`)}&body=${body}`;
    setOpening(true);
    window.location.href = mailto;
    setTimeout(() => setOpening(false), 1500);
  };

  return (
    <MarketingLayout>
      <Seo
        title="Contact"
        description={`Questions, feedback or security reports for CloudGather — email ${siteConfig.supportEmail}.`}
        path="/contact"
        jsonLd={[breadcrumbJsonLd([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])]}
      />

      <section className="border-b bg-dotted" aria-labelledby="contact-hero">
        <div className="container px-4 py-16 text-center sm:px-6 lg:py-20">
          <h1 id="contact-hero" className="text-4xl font-extrabold tracking-tight sm:text-5xl">
            Talk to us
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Real humans read every message. We usually reply within one business day.
          </p>
        </div>
      </section>

      <section className="container px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <CardDescription>
                This opens your email client with everything pre-filled — nothing is submitted to a server.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(errors.name)} />
                    {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={Boolean(errors.email)} />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} aria-invalid={Boolean(errors.subject)} />
                  {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <textarea
                    id="message"
                    className="flex min-h-[140px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    aria-invalid={Boolean(errors.message)}
                  />
                  {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
                </div>
                <Button type="submit" disabled={opening}>
                  {opening && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" /> Compose email
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <Bug className="h-5 w-5 text-accent" aria-hidden="true" />
              <h2 className="mt-2 text-sm font-semibold">Security issues</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Found a vulnerability? Email <span className="font-medium">security@</span> via the button above with
                &quot;Security&quot; in the subject and we&apos;ll treat it as confidential.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5">
              <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
              <h2 className="mt-2 text-sm font-semibold">Developer questions</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                API questions are often answered faster in the docs.
              </p>
              <Button variant="link" size="sm" className="mt-1 h-auto p-0 text-xs" asChild>
                <a href="/developers">
                  API documentation <ExternalLink className="ml-1 h-3 w-3" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ContactPage;
