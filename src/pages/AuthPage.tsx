import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, MailCheck, ArrowLeft } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const PASSWORD_MIN = 8;

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

interface AuthPageProps {
  mode: "login" | "register";
}

/** Unified authentication surface: sign in, create account, request a reset link. */
const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { user, loading, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true });
    }
  }, [user, loading, navigate, from]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!emailOk(email)) errors.email = "Enter a valid email address.";
    if (password.length < PASSWORD_MIN) errors.password = `Password must be at least ${PASSWORD_MIN} characters.`;
    if (mode === "register") {
      if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // guard against double submit
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (mode === "login") {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          toast.error(error.message || "Could not sign you in. Check your email and password.");
          return;
        }
        toast.success("Welcome back!");
        navigate(from, { replace: true });
      } else {
        const { data, error } = await signUp(email.trim(), password, displayName.trim() || undefined);
        if (error) {
          toast.error(error.message || "Could not create your account.");
          return;
        }
        // If email confirmation is enabled there is no session yet.
        if (!data.session) {
          toast.success("Account created — check your inbox to confirm your email address.");
          navigate("/login", { replace: true });
          return;
        }
        toast.success("Welcome to CloudGather!");
        navigate(from, { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!emailOk(email)) {
      setFieldErrors({ email: "Enter your email address first, then click reset." });
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await resetPassword(email.trim());
      if (error) {
        toast.error(error.message || "Could not send the reset email.");
        return;
      }
      setResetSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo
        title={isLogin ? "Sign in" : "Create your account"}
        description={isLogin ? "Sign in to your CloudGather workspace." : "Create a free CloudGather account and unify your cloud storage."}
        path={isLogin ? "/login" : "/register"}
      />
      <div className="container flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              {resetSent ? "Check your email" : isLogin ? "Sign in" : "Create your account"}
            </CardTitle>
            <CardDescription>
              {resetSent
                ? `We sent a password reset link to ${email}. The link expires shortly.`
                : isLogin
                  ? "Enter your email and password to access your files."
                  : "Free to start. Connect your first cloud drive in minutes."}
            </CardDescription>
          </CardHeader>

          {resetSent ? (
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-4 text-sm">
                <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <p>
                  Didn&apos;t receive it? Check your spam folder, or{" "}
                  <button
                    type="button"
                    className="font-medium text-primary underline underline-offset-2"
                    onClick={() => setResetSent(false)}
                  >
                    try another address
                  </button>
                  .
                </p>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Back to sign in
                </Link>
              </Button>
            </CardContent>
          ) : (
            <>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Name</Label>
                      <Input
                        id="displayName"
                        name="displayName"
                        autoComplete="name"
                        placeholder="Alex Rivera"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={80}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="email-error" className="text-sm text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      {isLogin && (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          onClick={handleForgotPassword}
                          disabled={isSubmitting}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete={isLogin ? "current-password" : "new-password"}
                        required
                        placeholder={isLogin ? "Your password" : `At least ${PASSWORD_MIN} characters`}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        aria-invalid={Boolean(fieldErrors.password)}
                        aria-describedby={fieldErrors.password ? "password-error" : undefined}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={0}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                    {fieldErrors.password && (
                      <p id="password-error" className="text-sm text-destructive">{fieldErrors.password}</p>
                    )}
                  </div>

                  {!isLogin && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm password</Label>
                      <Input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        aria-invalid={Boolean(fieldErrors.confirmPassword)}
                        aria-describedby={fieldErrors.confirmPassword ? "confirm-error" : undefined}
                      />
                      {fieldErrors.confirmPassword && (
                        <p id="confirm-error" className="text-sm text-destructive">{fieldErrors.confirmPassword}</p>
                      )}
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isLogin ? "Sign in" : "Create account"}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="justify-center border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "New to CloudGather? " : "Already have an account? "}
                  <Link
                    to={isLogin ? "/register" : "/login"}
                    className={cn("font-medium text-primary underline-offset-2 hover:underline")}
                  >
                    {isLogin ? "Create an account" : "Sign in"}
                  </Link>
                </p>
              </CardFooter>
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-2 hover:text-foreground">Terms of Service</Link>{" "}
          and{" "}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
          {" "}Need help? <a href={`mailto:${siteConfig.supportEmail}`} className="underline underline-offset-2 hover:text-foreground">{siteConfig.supportEmail}</a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
