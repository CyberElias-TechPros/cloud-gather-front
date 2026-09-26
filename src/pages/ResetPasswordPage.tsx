import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAppConfig } from "@/hooks/useAppConfig";
import { DEFAULT_PASSWORD_POLICY, validatePassword } from "@/lib/password";
import { toast } from "sonner";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

/**
 * Completion step of the password reset flow. The API emails a single-use
 * token; this form exchanges it for a new password and sends the user to
 * sign in again (all other sessions are revoked server-side).
 */
const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const { confirmPasswordReset } = useAuth();
  const { data: config } = useAppConfig();
  const policy = config?.policy?.password ?? DEFAULT_PASSWORD_POLICY;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const errors: Record<string, string> = {};
    const failure = validatePassword(password, policy);
    if (failure) errors.password = failure;
    if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const { error } = await confirmPasswordReset(token, password);
      if (error) {
        toast.error(error.message || "Could not update your password. Request a new link.");
        return;
      }
      toast.success("Password updated. Sign in with your new password.");
      navigate("/login", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo title="Reset your password" description="Choose a new password for your CloudGather account." path="/reset-password" noIndex />
      <div className="container flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Link to="/" aria-label="CloudGather home">
            <Logo />
          </Link>
        </div>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
            <CardDescription>
              For your security, signing in again will be required on all your devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!token ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>This link is incomplete</AlertTitle>
                  <AlertDescription>
                    Reset links expire after a short time. Request a fresh one from the sign-in page.
                  </AlertDescription>
                </Alert>
                <Button className="w-full" asChild>
                  <Link to="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <PasswordField
                  id="password"
                  label="New password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  required
                  policy={policy}
                  error={fieldErrors.password}
                />
                <PasswordField
                  id="confirmPassword"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  required
                  error={fieldErrors.confirmPassword}
                />
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Update password
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="underline underline-offset-2 hover:text-foreground">Back to sign in</Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
