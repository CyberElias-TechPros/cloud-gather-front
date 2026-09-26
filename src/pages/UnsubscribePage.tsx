import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailX, Loader2, CheckCircle2 } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo } from "@/components/common/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { unsubscribeNewsletter } from "@/services/system";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

/** One-click newsletter unsubscribe target used by marketing emails. */
const UnsubscribePage: React.FC = () => {
  const [params] = useSearchParams();
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [done, setDone] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await unsubscribeNewsletter(email.trim());
      setDone(true);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MarketingLayout>
      <Seo title="Unsubscribe" description="Manage your CloudGather email subscription." path="/unsubscribe" noIndex />
      <div className="container flex max-w-md flex-col justify-center px-4 py-20 sm:px-6">
        <Card>
          <CardHeader className="text-center">
            {done ? (
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            ) : (
              <MailX className="mx-auto h-10 w-10 text-muted-foreground" />
            )}
            <CardTitle className="pt-2">{done ? "You're unsubscribed" : "Unsubscribe from emails"}</CardTitle>
            <CardDescription>
              {done
                ? "You won't receive any more marketing emails from us. Account and security emails still apply."
                : "Enter the address you'd like us to stop emailing."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <Button className="w-full" asChild>
                <Link to="/">Back to CloudGather</Link>
              </Button>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy || !email.includes("@")}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Unsubscribe
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
};

export default UnsubscribePage;
