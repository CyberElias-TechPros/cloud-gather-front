import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { confirmVerificationEmail, sendVerificationEmail } from "@/services/account";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/** Confirms an email address from the link in the verification email. */
const VerifyEmailPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [state, setState] = React.useState<"working" | "done" | "error">(token ? "working" : "error");
  const [message, setMessage] = React.useState(token ? "" : "This confirmation link is incomplete.");
  const [resending, setResending] = React.useState(false);

  React.useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        await confirmVerificationEmail(token);
        if (!active) return;
        setState("done");
        await refresh();
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(errorMessage(error));
      }
    })();
    return () => {
      active = false;
    };
  }, [token, refresh]);

  const resend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      toast.success("A fresh confirmation email is on its way.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo title="Confirm your email" description="Confirm your CloudGather email address." path="/verify-email" noIndex />
      <div className="container flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              {state === "working" ? "Confirming your email…" : state === "done" ? "Email confirmed" : "We couldn't confirm that link"}
            </CardTitle>
            <CardDescription>
              {state === "done"
                ? "Your address is verified — every feature is now unlocked."
                : state === "error"
                  ? message
                  : "One moment please."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            {state === "working" ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : null}
            {state === "done" ? <CheckCircle2 className="h-8 w-8 text-emerald-500" /> : null}
            {state === "error" ? <TriangleAlert className="h-8 w-8 text-destructive" /> : null}

            {state === "done" ? (
              <Button className="w-full" onClick={() => navigate(user ? "/dashboard" : "/login")}>
                {user ? "Go to dashboard" : "Sign in"}
              </Button>
            ) : state === "error" ? (
              <div className="w-full space-y-2">
                {user ? (
                  <Button className="w-full" onClick={resend} disabled={resending}>
                    {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Send a new link
                  </Button>
                ) : null}
                <Button variant="outline" className="w-full" asChild>
                  <Link to={user ? "/dashboard" : "/login"}>{user ? "Back to dashboard" : "Back to sign in"}</Link>
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
