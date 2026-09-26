import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth, type MfaChallenge } from "@/contexts/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Seo } from "@/components/common/Seo";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAppConfig } from "@/hooks/useAppConfig";
import { DEFAULT_PASSWORD_POLICY, validatePassword } from "@/lib/password";
import { toast } from "sonner";
import { Loader2, MailCheck, ArrowLeft, ShieldCheck, Info } from "lucide-react";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

interface AuthPageProps {
  mode: "login" | "register";
}

/** Unified authentication surface: sign in, 2FA, create account, request a reset link. */
const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const { user, loading, signIn, signUp, verifyMfa, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { data: config } = useAppConfig();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [challenge, setChallenge] = useState<MfaChallenge | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";
  const oauthError = params.get("error");
  const isLogin = mode === "login";
  const policy = config?.policy?.password ?? DEFAULT_PASSWORD_POLICY;
  const registrationClosed = config?.policy?.registration_enabled === false;
  const allowlist = config?.policy?.signup_domain_allowlist ?? [];

  useEffect(() => {
    if (oauthError) toast.error(decodeURIComponent(oauthError));
  }, [oauthError]);

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true });
  }, [user, loading, navigate, from]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!emailOk(email)) errors.email = "Enter a valid email address.";
    if (!isLogin) {
      const failure = validatePassword(password, policy);
      if (failure) errors.password = failure;
      if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
      if (!acceptTerms) errors.terms = "Please accept the terms to continue.";
      if (allowlist.length && !allowlist.some((domain) => email.toLowerCase().endsWith(`@${domain.toLowerCase()}`))) {
        errors.email = `Sign-ups are limited to: ${allowlist.join(", ")}`;
      }
    } else if (!password) {
      errors.password = "Enter your password.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);
    try {
      if (isLogin) {
        const { error, mfa } = await signIn(email.trim(), password);
        if (mfa) {
          setChallenge(mfa);
          setPassword("");
          return;
        }
        if (error) {
          toast.error(error.message || "Could not sign you in. Check your email and password.");
          return;
        }
        toast.success("Welcome back!");
        navigate(from, { replace: true });
      } else {
        const { data, error } = await signUp(email.trim(), password, displayName.trim() || undefined, marketingOptIn);
        if (error) {
          toast.error(error.message || "Could not create your account.");
          return;
        }
        if (config?.policy?.require_email_verification && data.user && !data.user.email_verified) {
          setPendingVerification(true);
          return;
        }
        toast.success("Welcome to CloudGather! Let's connect your first drive.");
        navigate(data.session ? "/dashboard" : "/login", { replace: true });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMfa = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challenge || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await verifyMfa(challenge.challenge, mfaCode.trim(), useRecoveryCode ? "recovery_code" : "totp");
      if (error) {
        toast.error(error.message || "That code was not accepted.");
        return;
      }
      toast.success("Welcome back!");
      navigate(from, { replace: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
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

  const heading = challenge
    ? "Two-factor authentication"
    : pendingVerification
      ? "Confirm your email"
      : resetSent
        ? "Check your email"
        : isLogin
          ? "Sign in"
          : "Create your account";

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo
        title={isLogin ? "Sign in" : "Create your account"}
        description={isLogin ? "Sign in to your CloudGather workspace." : "Create a free CloudGather account and unify your cloud storage."}
        path={isLogin ? "/login" : "/register"}
      />
      <div className="container flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex justify-center">
          <Link to="/" aria-label={`${siteConfig.name} home`}>
            <Logo />
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">{heading}</CardTitle>
            <CardDescription>
              {challenge
                ? "Enter the 6-digit code from your authenticator app."
                : pendingVerification
                  ? `We sent a confirmation link to ${email}. Confirm it to activate your workspace.`
                  : resetSent
                    ? `We sent a password reset link to ${email}. The link expires shortly.`
                    : isLogin
                      ? "Enter your email and password to access your files."
                      : "Free to start. Connect your first cloud drive in minutes."}
            </CardDescription>
          </CardHeader>

          {challenge ? (
            <CardContent>
              <form onSubmit={handleMfa} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfaCode">{useRecoveryCode ? "Recovery code" : "Authentication code"}</Label>
                  <Input
                    id="mfaCode"
                    autoFocus
                    autoComplete="one-time-code"
                    inputMode={useRecoveryCode ? "text" : "numeric"}
                    placeholder={useRecoveryCode ? "xxxx-xxxx" : "123456"}
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || mfaCode.length < 6}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <ShieldCheck className="mr-2 h-4 w-4" /> Verify
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => {
                      setUseRecoveryCode((current) => !current);
                      setMfaCode("");
                    }}
                  >
                    {useRecoveryCode ? "Use authenticator app" : "Use a recovery code"}
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground underline-offset-2 hover:underline"
                    onClick={() => {
                      setChallenge(null);
                      setMfaCode("");
                    }}
                  >
                    Start over
                  </button>
                </div>
              </form>
            </CardContent>
          ) : pendingVerification ? (
            <CardContent className="space-y-4">
              <Alert>
                <MailCheck className="h-4 w-4" />
                <AlertTitle>Almost there</AlertTitle>
                <AlertDescription>
                  Click the link in the email to finish setting up your account. You can close this tab.
                </AlertDescription>
              </Alert>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
                </Link>
              </Button>
            </CardContent>
          ) : resetSent ? (
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
              <CardContent className="space-y-5">
                {!isLogin && registrationClosed ? (
                  <Alert variant="destructive">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Sign-ups are paused</AlertTitle>
                    <AlertDescription>
                      New accounts are temporarily disabled. <Link className="underline" to="/contact">Contact us</Link> for access.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <SocialButtons disabled={isSubmitting} />

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
                        onChange={(event) => setDisplayName(event.target.value)}
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
                      onChange={(event) => setEmail(event.target.value)}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? "email-error" : undefined}
                    />
                    {fieldErrors.email && (
                      <p id="email-error" className="text-sm text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>

                  <PasswordField
                    id="password"
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    placeholder={isLogin ? "Your password" : `At least ${policy.min_length} characters`}
                    error={fieldErrors.password}
                    policy={isLogin ? null : policy}
                    action={
                      isLogin ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          onClick={handleForgotPassword}
                          disabled={isSubmitting}
                        >
                          Forgot password?
                        </button>
                      ) : undefined
                    }
                  />

                  {!isLogin && (
                    <>
                      <PasswordField
                        id="confirmPassword"
                        label="Confirm password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        required
                        autoComplete="new-password"
                        error={fieldErrors.confirmPassword}
                      />

                      <div className="space-y-3 pt-1">
                        <label className="flex items-start gap-2 text-sm">
                          <Checkbox
                            checked={acceptTerms}
                            onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                            aria-describedby={fieldErrors.terms ? "terms-error" : undefined}
                          />
                          <span className="leading-snug text-muted-foreground">
                            I agree to the{" "}
                            <Link to="/terms" className="text-primary underline-offset-2 hover:underline">Terms</Link> and{" "}
                            <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">Privacy Policy</Link>.
                          </span>
                        </label>
                        {fieldErrors.terms && (
                          <p id="terms-error" className="text-sm text-destructive">{fieldErrors.terms}</p>
                        )}
                        <label className="flex items-start gap-2 text-sm">
                          <Checkbox checked={marketingOptIn} onCheckedChange={(checked) => setMarketingOptIn(checked === true)} />
                          <span className="leading-snug text-muted-foreground">
                            Email me product updates and tips. No spam, unsubscribe anytime.
                          </span>
                        </label>
                      </div>
                    </>
                  )}

                  <Button type="submit" className="w-full" disabled={isSubmitting || (!isLogin && registrationClosed)}>
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
          Need help?{" "}
          <a href={`mailto:${siteConfig.supportEmail}`} className="underline underline-offset-2 hover:text-foreground">
            {siteConfig.supportEmail}
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
