import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Turnstile } from "@/components/common/Turnstile";
import { Seo, breadcrumbJsonLd } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuth } from "@/contexts/AuthContext";
import { submitContactForm } from "@/services/system";
import { errorMessage } from "@/lib/api";
import { CheckCircle2, Loader2, Mail, Bug, BookOpen, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const TOPIC_LABELS: Record<string, string> = {
  general: "General question",
  support: "Technical support",
  sales: "Sales & plans",
  billing: "Billing",
  security: "Security report",
  partnership: "Partnership",
  press: "Press",
};

/** Support form that files a ticket through the API (no black-hole mailto). */
const ContactPage: React.FC = () => {
  const { user, profile } = useAuth();
  const { data: config } = useAppConfig();

  const [name, setName] = useState(profile?.display_name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [topic, setTopic] = useState("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  React.useEffect(() => {
    if (user?.email && !email) setEmail(user.email);
    if (profile?.display_name && !name) setName(profile.display_name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, profile?.display_name]);

  const topics = config?.contact_topics ?? ["general", "support", "sales", "billing", "security"];
  const siteKey = config?.turnstile_site_key ?? null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Please tell us your name.";
    if (!emailOk(email)) nextErrors.email = "Enter a valid email address.";
    if (!subject.trim()) nextErrors.subject = "Add a short subject.";
    if (message.trim().length < 10) nextErrors.message = "Please describe your question (at least 10 characters).";
    if (siteKey && !token) nextErrors.turnstile = "Please complete the anti-spam check.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSending(true);
    try {
      const result = await submitContactForm({
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
        topic,
        company: company.trim() || undefined,
        turnstile_token: token || undefined,
      });
      setSent(result.id);
      setSubject("");
      setMessage("");
      toast.success(result.message || "Message sent — we'll be in touch.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
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
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <CardDescription>We'll email you a reply — no account required.</CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Message received</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      Your reference is <code className="rounded bg-muted px-1 py-0.5 text-xs">{sent.slice(0, 8)}</code>. We&apos;ll
                      reply to {email}.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setSent(null)}>
                      Send another message
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        aria-invalid={Boolean(errors.name)}
                      />
                      {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        aria-invalid={Boolean(errors.email)}
                      />
                      {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic</Label>
                      <Select value={topic} onValueChange={setTopic}>
                        <SelectTrigger id="topic">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {topics.map((item) => (
                            <SelectItem key={item} value={item}>
                              {TOPIC_LABELS[item] ?? item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company">Company (optional)</Label>
                      <Input id="company" value={company} onChange={(event) => setCompany(event.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      aria-invalid={Boolean(errors.subject)}
                    />
                    {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      rows={6}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      aria-invalid={Boolean(errors.message)}
                      placeholder="How can we help?"
                    />
                    {errors.message && <p className="text-sm text-destructive">{errors.message}</p>}
                  </div>

                  {siteKey ? (
                    <div className="space-y-1">
                      <Turnstile siteKey={siteKey} onToken={setToken} />
                      {errors.turnstile && <p className="text-sm text-destructive">{errors.turnstile}</p>}
                    </div>
                  ) : null}

                  <Button type="submit" disabled={sending}>
                    {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Send message
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4" /> Email us directly
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <a href={`mailto:${siteConfig.supportEmail}`} className="text-primary underline-offset-2 hover:underline">
                  {siteConfig.supportEmail}
                </a>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="h-4 w-4" /> Security disclosure
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Found a vulnerability? Choose the “Security report” topic — we triage those first and never take legal
                action against good-faith research.
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4" /> Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link to="/developers" className="flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                  API reference <ExternalLink className="h-3 w-3" />
                </Link>
                <Link to="/status" className="flex items-center gap-1 text-primary underline-offset-2 hover:underline">
                  System status <ExternalLink className="h-3 w-3" />
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bug className="h-4 w-4" /> Found a bug?
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Include the page URL and what you expected to happen — it gets fixed much faster.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default ContactPage;
