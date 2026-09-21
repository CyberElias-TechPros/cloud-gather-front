import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth, type ProfileUpdates } from "@/contexts/AuthContext";
import { Seo } from "@/components/common/Seo";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Monitor, Moon, Sun, Download, Trash2, ShieldCheck, Laptop } from "lucide-react";

/** Shape of the per-user preferences document persisted in profiles.settings. */
interface UserPreferences {
  defaultView: "list" | "grid";
  emailProductUpdates: boolean;
  emailSecurityAlerts: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  defaultView: "list",
  emailProductUpdates: false,
  emailSecurityAlerts: true,
};

function readPreferences(raw: unknown): UserPreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFERENCES };
  const source = raw as Record<string, unknown>;
  return {
    defaultView: source.defaultView === "grid" ? "grid" : "list",
    emailProductUpdates: Boolean(source.emailProductUpdates),
    emailSecurityAlerts: source.emailSecurityAlerts !== false,
  };
}

const SettingsPage: React.FC = () => {
  const { user, profile, loading: authLoading, updateProfile, updatePassword, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [savingProfile, setSavingProfile] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  const [exportBusy, setExportBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setPreferences(readPreferences(profile.settings));
    }
  }, [profile]);

  const persistProfile = async (updates: ProfileUpdates, successMessage: string) => {
    setSavingProfile(true);
    try {
      await updateProfile(updates);
      toast.success(successMessage);
    } catch (err) {
      toast.error((err as Error).message || "Could not save your changes.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    void persistProfile({ display_name: displayName.trim(), avatar_url: avatarUrl.trim() || null }, "Profile updated");
  };

  const updatePreference = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    setSavingPreferences(true);
    updateProfile({ settings: next as unknown as Record<string, unknown> })
      .then(() => toast.success("Preference saved"))
      .catch((err: Error) => {
        setPreferences(preferences);
        toast.error(err.message || "Could not save preference.");
      })
      .finally(() => setSavingPreferences(false));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (newPassword.length < 8) errors.newPassword = "At least 8 characters.";
    if (newPassword !== confirmPassword) errors.confirmPassword = "Passwords do not match.";
    setPasswordErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message || "Could not change your password.");
        return;
      }
      toast.success("Password changed. Other sessions remain signed in — sign out everywhere if needed.");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExport = async () => {
    setExportBusy(true);
    try {
      const payload = await api<Record<string, unknown>>("/export");
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cloudgather-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error((err as Error).message || "Could not build your export.");
    } finally {
      setExportBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE" || deleteBusy) return;
    setDeleteBusy(true);
    try {
      // The edge function verifies the caller's session and performs the full
      // cascade (files, objects, shares, keys, profile, auth user).
      await api("/account", { method: "DELETE" });
      toast.success("Your account has been deleted. Goodbye!");
      await signOut();
      navigate("/", { replace: true });
    } catch (err) {
      toast.error((err as Error).message || "Account deletion failed.");
    } finally {
      setDeleteBusy(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const displayNameFallback = (profile?.display_name || user.email?.split("@")[0] || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Seo title="Settings" description="CloudGather settings" path="/settings" noIndex />
      <div>
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Manage your account, security and preferences.</p>
        </header>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          {/* ── Profile ─────────────────────────────────────────────── */}
          <TabsContent value="profile" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Public profile</CardTitle>
                <CardDescription>How you appear in shares and team contexts.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleProfileSave} className="space-y-5">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={avatarUrl || undefined} alt="" />
                      <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">
                        {displayNameFallback}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor="avatar-url">Avatar URL (optional)</Label>
                      <Input
                        id="avatar-url"
                        type="url"
                        placeholder="https://…"
                        value={avatarUrl}
                        onChange={(e) => setAvatarUrl(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="display-name">Display name</Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={user.email ?? ""} disabled aria-describedby="email-note" />
                    <p id="email-note" className="text-xs text-muted-foreground">
                      Your sign-in email can&apos;t be changed here yet.
                    </p>
                  </div>
                  <Button type="submit" disabled={savingProfile}>
                    {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Save changes
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Security ────────────────────────────────────────────── */}
          <TabsContent value="security" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change password</CardTitle>
                <CardDescription>
                  Choose a strong password you don&apos;t reuse anywhere else.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">New password</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      aria-invalid={Boolean(passwordErrors.newPassword)}
                    />
                    {passwordErrors.newPassword && (
                      <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">Confirm new password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      aria-invalid={Boolean(passwordErrors.confirmPassword)}
                    />
                    {passwordErrors.confirmPassword && (
                      <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                    )}
                  </div>
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                    Update password
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-4 w-4 text-success" aria-hidden="true" /> Sessions
                </CardTitle>
                <CardDescription>
                  Sessions are managed by your browser&apos;s authentication cookie. Changing your password keeps
                  other sessions alive — sign out below to end this one, or use &quot;sign out everywhere&quot; from
                  a private window for a full reset.
                </CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>

          {/* ── Preferences ─────────────────────────────────────────── */}
          <TabsContent value="preferences" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Appearance</CardTitle>
                <CardDescription>Follows your system by default.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="theme-select" className="flex items-center gap-2">
                    {theme === "dark" ? <Moon className="h-4 w-4" aria-hidden="true" /> : theme === "light" ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Monitor className="h-4 w-4" aria-hidden="true" />}
                    Theme
                  </Label>
                  <Select value={theme ?? "system"} onValueChange={setTheme}>
                    <SelectTrigger id="theme-select" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">
                        <span className="flex items-center gap-2"><Sun className="h-3.5 w-3.5" aria-hidden="true" /> Light</span>
                      </SelectItem>
                      <SelectItem value="dark">
                        <span className="flex items-center gap-2"><Moon className="h-3.5 w-3.5" aria-hidden="true" /> Dark</span>
                      </SelectItem>
                      <SelectItem value="system">
                        <span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" aria-hidden="true" /> System</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="default-view">Default file view</Label>
                    <p className="text-xs text-muted-foreground">Applied when you open Files.</p>
                  </div>
                  <Select
                    value={preferences.defaultView}
                    onValueChange={(value) => updatePreference("defaultView", value as "list" | "grid")}
                  >
                    <SelectTrigger id="default-view" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="list"><span className="flex items-center gap-2"><Laptop className="h-3.5 w-3.5" aria-hidden="true" /> List</span></SelectItem>
                      <SelectItem value="grid">Grid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {savingPreferences && (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> Saving…
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Email notifications</CardTitle>
                <CardDescription>We send very little email — and never sell your address.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="security-emails">Security alerts</Label>
                    <p className="text-xs text-muted-foreground">New sign-ins and provider connections.</p>
                  </div>
                  <Switch
                    id="security-emails"
                    checked={preferences.emailSecurityAlerts}
                    onCheckedChange={(checked) => updatePreference("emailSecurityAlerts", checked)}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="product-emails">Product updates</Label>
                    <p className="text-xs text-muted-foreground">Occasional news about new features. Rarely.</p>
                  </div>
                  <Switch
                    id="product-emails"
                    checked={preferences.emailProductUpdates}
                    onCheckedChange={(checked) => updatePreference("emailProductUpdates", checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Data ────────────────────────────────────────────────── */}
          <TabsContent value="data" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export your data</CardTitle>
                <CardDescription>
                  Downloads a JSON file with your account info, file catalog, provider connections and shares.
                  File contents stay in your connected provider accounts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => void handleExport()} disabled={exportBusy}>
                  {exportBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="mr-2 h-4 w-4" aria-hidden="true" />}
                  Download export
                </Button>
              </CardContent>
            </Card>

            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base text-destructive">Delete account</CardTitle>
                <CardDescription>
                  Permanently deletes your account, uploaded files, metadata, shares and API keys, and removes
                  stored provider tokens. <strong>This cannot be undone.</strong> Download an export first if you
                  want a copy of your data.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => { setDeleteOpen(true); setDeleteConfirmText(""); }}>
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete my account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete account confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              Everything tied to your account will be permanently removed, including files you uploaded to
              CloudGather and stored provider tokens. Type <strong>DELETE</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder="DELETE"
            aria-label='Type DELETE to confirm'
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteAccount()}
              disabled={deleteConfirmText !== "DELETE" || deleteBusy}
            >
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsPage;
