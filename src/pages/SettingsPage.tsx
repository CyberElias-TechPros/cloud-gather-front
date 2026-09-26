import React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import QRCode from "qrcode";
import {
  Camera,
  Check,
  Download,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Save,
  ShieldCheck,
  ShieldOff,
  Sun,
  Trash2,
  TriangleAlert,
  User,
  Unlink,
} from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CopyButton } from "@/components/common/CopyButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import {
  cancelAccountDeletion,
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  exportAccountData,
  getPreferences,
  listIdentities,
  listSessions,
  regenerateRecoveryCodes,
  removeAvatar,
  requestAccountDeletion,
  revokeAllSessions,
  revokeSession,
  savePreferences,
  sendVerificationEmail,
  startTwoFactor,
  unlinkIdentity,
  uploadAvatar,
} from "@/services/account";
import { DEFAULT_PASSWORD_POLICY, validatePassword } from "@/lib/password";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

const TIMEZONES: string[] = (() => {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    return intl.supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
})();
const LOCALES = [
  { value: "en", label: "English" },
  { value: "en-GB", label: "English (UK)" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
];

/** Account settings: profile, preferences, security and data controls. */
const SettingsPage: React.FC = () => {
  const { user, profile, updateProfile, refresh, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const { data: config } = useAppConfig();
  const policy = config?.policy?.password ?? DEFAULT_PASSWORD_POLICY;

  /* profile state */
  const [displayName, setDisplayName] = React.useState(profile?.display_name ?? "");
  const [locale, setLocale] = React.useState("en");
  const [timezone, setTimezone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [marketingOptIn, setMarketingOptIn] = React.useState(false);
  const avatarInput = React.useRef<HTMLInputElement>(null);

  /* security state */
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [twoFactorOpen, setTwoFactorOpen] = React.useState(false);
  const [totpSecret, setTotpSecret] = React.useState<{ secret: string; otpauth_url: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null);
  const [totpCode, setTotpCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);
  const [disableOpen, setDisableOpen] = React.useState(false);
  const [disablePassword, setDisablePassword] = React.useState("");
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [signOutAllOpen, setSignOutAllOpen] = React.useState(false);

  const preferences = useQuery({ queryKey: ["preferences"], queryFn: getPreferences });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: listSessions });
  const identities = useQuery({ queryKey: ["identities"], queryFn: listIdentities });

  React.useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.display_name]);

  React.useEffect(() => {
    const prefs = preferences.data?.preferences as Record<string, unknown> | undefined;
    if (!prefs) return;
    if (typeof prefs.locale === "string") setLocale(prefs.locale);
    if (typeof prefs.timezone === "string" && prefs.timezone) setTimezone(prefs.timezone);
    if (typeof prefs.marketing_opt_in === "boolean") setMarketingOptIn(prefs.marketing_opt_in);
    if (typeof prefs.theme === "string" && prefs.theme && prefs.theme !== theme) setTheme(prefs.theme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      await updateProfile({ display_name: displayName.trim(), locale, timezone, marketing_opt_in: marketingOptIn });
      await savePreferences({ locale, timezone, marketing_opt_in: marketingOptIn, theme });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["preferences"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const avatar = useMutation({
    mutationFn: (file: File) => uploadAvatar(file),
    onSuccess: async () => {
      toast.success("Photo updated");
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const clearAvatar = useMutation({
    mutationFn: removeAvatar,
    onSuccess: async () => {
      toast.success("Photo removed");
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const password = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed. Other sessions were signed out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const beginTwoFactor = useMutation({
    mutationFn: startTwoFactor,
    onSuccess: async (data) => {
      setTotpSecret(data);
      setTwoFactorOpen(true);
      try {
        setQrDataUrl(await QRCode.toDataURL(data.otpauth_url, { margin: 1, width: 220 }));
      } catch {
        setQrDataUrl(null);
      }
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const confirmTwoFactor = useMutation({
    mutationFn: () => enableTwoFactor(totpCode.trim()),
    onSuccess: async (data) => {
      setRecoveryCodes(data.recovery_codes ?? null);
      setTotpCode("");
      setTwoFactorOpen(false);
      toast.success("Two-factor authentication enabled");
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const turnOffTwoFactor = useMutation({
    mutationFn: () => disableTwoFactor(disablePassword),
    onSuccess: async () => {
      toast.success("Two-factor authentication disabled");
      setDisableOpen(false);
      setDisablePassword("");
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const newRecoveryCodes = useMutation({
    mutationFn: regenerateRecoveryCodes,
    onSuccess: (data) => {
      setRecoveryCodes(data.recovery_codes ?? null);
      toast.success("New recovery codes generated");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const killSession = useMutation({
    mutationFn: (id: string) => revokeSession(id),
    onSuccess: () => {
      toast.success("Session signed out");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const killAllSessions = useMutation({
    mutationFn: revokeAllSessions,
    onSuccess: async () => {
      toast.success("Signed out everywhere");
      await signOut();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unlink = useMutation({
    mutationFn: (id: string) => unlinkIdentity(id),
    onSuccess: () => {
      toast.success("Account unlinked");
      queryClient.invalidateQueries({ queryKey: ["identities"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const exportData = useMutation({
    mutationFn: exportAccountData,
    onSuccess: () => toast.success("Export downloaded"),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteAccount = useMutation({
    mutationFn: () => requestAccountDeletion(deletePassword || undefined),
    onSuccess: (data) => {
      toast.success(
        data.purge_at ? `Account scheduled for deletion on ${formatDateTime(data.purge_at)}` : "Account deletion requested",
      );
      setDeleteOpen(false);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restoreAccount = useMutation({
    mutationFn: cancelAccountDeletion,
    onSuccess: async () => {
      toast.success("Deletion cancelled — welcome back!");
      await refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resendVerify = useMutation({
    mutationFn: sendVerificationEmail,
    onSuccess: () => toast.success("Verification email sent"),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const passwordError = newPassword ? validatePassword(newPassword, policy) : null;
  const initials = (displayName || user?.email || "?").slice(0, 2).toUpperCase();
  const pendingDeletion = user?.status === "pending_deletion";

  return (
    <div className="space-y-6">
      <Seo title="Settings" description="Manage your CloudGather profile, security and data." path="/settings" noIndex />
      <PageHeader title="Settings" icon={User} description="Your profile, security and data controls." />

      {pendingDeletion ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>This account is scheduled for deletion</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>You can cancel any time before the grace period ends.</span>
            <Button variant="outline" className="w-fit" onClick={() => restoreAccount.mutate()}>
              Keep my account
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="data">Data &amp; privacy</TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- profile */}
        <TabsContent value="profile" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>This is how you appear when you share files.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <input
                    ref={avatarInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) avatar.mutate(file);
                      event.target.value = "";
                    }}
                  />
                  <Button variant="outline" onClick={() => avatarInput.current?.click()} disabled={avatar.isPending}>
                    {avatar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                    Change photo
                  </Button>
                  {profile?.avatar_url ? (
                    <Button variant="ghost" onClick={() => clearAvatar.mutate()} disabled={clearAvatar.isPending}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Display name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={80}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex gap-2">
                    <Input id="email" value={user?.email ?? ""} readOnly className="bg-muted/40" />
                    {user?.email_verified ? (
                      <Badge variant="secondary" className="shrink-0 self-center gap-1">
                        <Check className="h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Button
                        variant="outline"
                        className="shrink-0"
                        onClick={() => resendVerify.mutate()}
                        disabled={resendVerify.isPending}
                      >
                        Verify
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------ preferences */}
        <TabsContent value="preferences" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Choose how CloudGather looks on this device.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "System", icon: Monitor },
              ].map((option) => (
                <Button
                  key={option.value}
                  variant={theme === option.value ? "default" : "outline"}
                  onClick={() => {
                    setTheme(option.value);
                    savePreferences({ theme: option.value }).catch(() => undefined);
                  }}
                >
                  <option.icon className="mr-2 h-4 w-4" /> {option.label}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Language &amp; region</CardTitle>
              <CardDescription>Used for dates, times and email content.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="locale">Language</Label>
                  <Select value={locale} onValueChange={setLocale}>
                    <SelectTrigger id="locale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Time zone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(TIMEZONES.length ? TIMEZONES : [timezone]).map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="marketing" className="text-sm font-medium">Product emails</Label>
                  <p className="text-xs text-muted-foreground">Occasional tips and feature announcements.</p>
                </div>
                <Switch id="marketing" checked={marketingOptIn} onCheckedChange={setMarketingOptIn} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save preferences
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/notifications">Notification settings</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------- security */}
        <TabsContent value="security" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password</CardTitle>
              <CardDescription>Changing your password signs out every other device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="max-w-md space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (passwordError) return toast.error(passwordError);
                  if (newPassword !== confirmPassword) return toast.error("Passwords do not match.");
                  password.mutate();
                }}
              >
                <PasswordField
                  id="current-password"
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
                <PasswordField
                  id="new-password"
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  policy={policy}
                />
                <PasswordField
                  id="confirm-new-password"
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  error={confirmPassword && confirmPassword !== newPassword ? "Passwords do not match." : undefined}
                />
                <Button type="submit" disabled={password.isPending || !newPassword}>
                  {password.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Change password
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Two-factor authentication
                {user?.two_factor_enabled ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> On
                  </Badge>
                ) : (
                  <Badge variant="outline">Off</Badge>
                )}
              </CardTitle>
              <CardDescription>Protect your account with a time-based one-time code.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {user?.two_factor_enabled ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => newRecoveryCodes.mutate()} disabled={newRecoveryCodes.isPending}>
                    Regenerate recovery codes
                  </Button>
                  <Button variant="ghost" className="text-destructive" onClick={() => setDisableOpen(true)}>
                    <ShieldOff className="mr-2 h-4 w-4" /> Turn off
                  </Button>
                </div>
              ) : (
                <Button onClick={() => beginTwoFactor.mutate()} disabled={beginTwoFactor.isPending}>
                  {beginTwoFactor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                  Set up two-factor
                </Button>
              )}

              {recoveryCodes ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Save your recovery codes</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p className="text-xs">Each code can be used once if you lose access to your authenticator.</p>
                    <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-3 font-mono text-xs sm:grid-cols-3">
                      {recoveryCodes.map((code) => (
                        <span key={code}>{code}</span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <CopyButton value={recoveryCodes.join("\n")} label="Copy codes" variant="outline" />
                      <Button size="sm" variant="ghost" onClick={() => setRecoveryCodes(null)}>
                        Done
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>Active sessions</CardTitle>
                <CardDescription>Devices currently signed in to your account.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSignOutAllOpen(true)}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out everywhere
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {sessions.isLoading ? (
                <div className="space-y-2 p-6">
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <ul className="divide-y">
                  {sessions.data?.map((session) => (
                    <li key={session.id} className="flex items-center gap-3 p-4">
                      <Laptop className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">
                          {session.client || "Unknown device"}
                          {session.current ? <Badge variant="secondary">This device</Badge> : null}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {session.ip_address ?? "unknown IP"}
                          {session.location ? ` · ${session.location}` : ""} · active {formatRelativeTime(session.last_seen_at)}
                        </p>
                      </div>
                      {!session.current ? (
                        <Button variant="ghost" size="sm" onClick={() => killSession.mutate(session.id)}>
                          Sign out
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Connected sign-in accounts</CardTitle>
              <CardDescription>Social accounts you can use to sign in.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {identities.isLoading ? (
                <div className="p-6">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (identities.data?.length ?? 0) === 0 ? (
                <p className="px-6 pb-6 text-sm text-muted-foreground">No social accounts linked.</p>
              ) : (
                <ul className="divide-y">
                  {identities.data?.map((identity) => (
                    <li key={identity.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium capitalize">{identity.provider}</p>
                        <p className="truncate text-xs text-muted-foreground">{identity.email ?? "—"}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => unlink.mutate(identity.id)}>
                        <Unlink className="mr-2 h-4 w-4" /> Unlink
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------- data */}
        <TabsContent value="data" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Export your data</CardTitle>
              <CardDescription>
                Download a JSON archive of your profile, file index, shares and activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => exportData.mutate()} disabled={exportData.isPending}>
                {exportData.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download export
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="text-destructive">Delete account</CardTitle>
              <CardDescription>
                Permanently removes your files, shares and connections after a short grace period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete my account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 2FA setup dialog */}
      <Dialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>Scan the QR code with Google Authenticator, 1Password or Authy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Two-factor QR code" className="mx-auto rounded-lg border bg-white p-2" />
            ) : (
              <Skeleton className="mx-auto h-[220px] w-[220px]" />
            )}
            {totpSecret ? (
              <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                <code className="flex-1 truncate font-mono text-xs">{totpSecret.secret}</code>
                <CopyButton value={totpSecret.secret} successMessage="Secret copied" />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="totp-code">Enter the 6-digit code</Label>
              <Input
                id="totp-code"
                inputMode="numeric"
                placeholder="123456"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTwoFactorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => confirmTwoFactor.mutate()} disabled={confirmTwoFactor.isPending || totpCode.length < 6}>
              {confirmTwoFactor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Turn off two-factor authentication?</DialogTitle>
            <DialogDescription>Confirm your password to continue. Your account will be less secure.</DialogDescription>
          </DialogHeader>
          <PasswordField
            id="disable-2fa-password"
            label="Password"
            value={disablePassword}
            onChange={setDisablePassword}
            autoComplete="current-password"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => turnOffTwoFactor.mutate()} disabled={turnOffTwoFactor.isPending}>
              {turnOffTwoFactor.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Turn off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete account */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Your files are scheduled for permanent deletion. You can cancel during the grace period by signing back in.
            </DialogDescription>
          </DialogHeader>
          <PasswordField
            id="delete-password"
            label="Confirm your password"
            value={deletePassword}
            onChange={setDeletePassword}
            autoComplete="current-password"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Keep my account
            </Button>
            <Button variant="destructive" onClick={() => deleteAccount.mutate()} disabled={deleteAccount.isPending}>
              {deleteAccount.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={signOutAllOpen}
        onOpenChange={setSignOutAllOpen}
        title="Sign out of every device?"
        description="You'll need to sign in again here too."
        confirmLabel="Sign out everywhere"
        destructive
        loading={killAllSessions.isPending}
        onConfirm={() => killAllSessions.mutate()}
      />
    </div>
  );
};

export default SettingsPage;
