import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

/**
 * Landing page for social sign-in. The API redirects here with a one-time
 * exchange token which we swap for a real session before entering the app.
 */
const AuthCallbackPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { adoptSession } = useAuth();
  const [failed, setFailed] = React.useState<string | null>(params.get("error"));

  const token = params.get("token");
  const expiresAt = params.get("expires_at") ?? undefined;

  React.useEffect(() => {
    let active = true;
    if (!token) {
      if (!params.get("error")) setFailed("The sign-in link was missing or has already been used.");
      return;
    }
    (async () => {
      const user = await adoptSession(token, expiresAt);
      if (!active) return;
      if (!user) {
        setFailed("We could not complete that sign-in. Please try again.");
        return;
      }
      toast.success(`Signed in as ${user.email}`);
      navigate(user.onboarded === false ? "/providers" : "/dashboard", { replace: true });
    })();
    return () => {
      active = false;
    };
  }, [token, expiresAt, adoptSession, navigate, params]);

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo title="Signing you in" description="Completing sign-in." path="/auth/callback" noIndex />
      <div className="container flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{failed ? "Sign-in failed" : "Signing you in…"}</CardTitle>
            <CardDescription>
              {failed ?? "Hold tight while we finish setting up your session."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-6">
            {failed ? (
              <>
                <TriangleAlert className="h-8 w-8 text-destructive" />
                <Button asChild className="w-full">
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </>
            ) : (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
