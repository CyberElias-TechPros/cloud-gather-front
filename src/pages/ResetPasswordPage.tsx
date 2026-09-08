import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";

const PASSWORD_MIN = 8;

/**
 * Password reset completion page. Supabase sends the user here with a
 * recovery token in the URL fragment; onAuthStateChange picks up the session
 * and this form then sets the new password.
 */
const ResetPasswordPage: React.FC = () => {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Wait a moment for the recovery session to be established from the URL hash.
  const [sessionWait, setSessionWait] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setSessionWait(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters.`;
    if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        toast.error(error.message || "Could not update your password. The reset link may have expired.");
        return;
      }
      toast.success("Password updated. You are now signed in.");
      navigate("/dashboard", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  const waiting = loading || sessionWait;

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo title="Reset your password" description="Choose a new password for your CloudGather account." path="/reset-password" noIndex />
      <div className="container flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Choose a new password</CardTitle>
            <CardDescription>Pick something strong you don&apos;t use anywhere else.</CardDescription>
          </CardHeader>

          {waiting ? (
            <CardContent className="flex items-center justify-center py-10" role="status" aria-live="polite">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <span className="ml-3 text-sm text-muted-foreground">Verifying reset link…</span>
            </CardContent>
          ) : !user ? (
            <CardContent className="space-y-4">
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </div>
              <Button asChild className="w-full">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New password</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        aria-invalid={Boolean(fieldErrors.password)}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                    {fieldErrors.password && <p className="text-sm text-destructive">{fieldErrors.password}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.confirmPassword)}
                    />
                    {fieldErrors.confirmPassword && <p className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                    Update password
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
