import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Save, Loader2, ShieldAlert, RotateCcw } from "lucide-react";

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: unknown;
  description: string | null;
}

type EditableValue = boolean | number | string;

/**
 * Typed presentation hints for the settings keys the console knows about.
 * Unknown keys still render (as generic JSON) so nothing is hidden or lost.
 */
const settingMeta: Record<string, { label: string; kind: "boolean" | "number" | "string" | "json" }> = {
  app_name: { label: "Application name", kind: "string" },
  app_description: { label: "Application description", kind: "string" },
  app_version: { label: "Application version", kind: "string" },
  maintenance_mode: { label: "Maintenance mode", kind: "boolean" },
  registration_enabled: { label: "Allow new registrations", kind: "boolean" },
  email_verification_required: { label: "Require email verification", kind: "boolean" },
  max_file_size_mb: { label: "Max upload size (MB)", kind: "number" },
  max_storage_per_user_gb: { label: "Max storage per user (GB)", kind: "number" },
  api_rate_limit_per_minute: { label: "API rate limit (requests/min)", kind: "number" },
  session_timeout_minutes: { label: "Session timeout (minutes)", kind: "number" },
  password_min_length: { label: "Minimum password length", kind: "number" },
  analytics_enabled: { label: "Usage analytics", kind: "boolean" },
  error_reporting_enabled: { label: "Error reporting", kind: "boolean" },
  audit_logging_enabled: { label: "Detailed audit logging", kind: "boolean" },
  virus_scanning_enabled: { label: "Virus scanning for uploads", kind: "boolean" },
  allowed_file_types: { label: "Allowed file types (JSON)", kind: "json" },
};

const AdminSystemSettings = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, EditableValue>>({});

  const { data: settings, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["system-settings"],
    queryFn: async (): Promise<SystemSetting[]> => (await api<{ settings: SystemSetting[] }>("/admin/settings")).settings,
  });

  useEffect(() => {
    if (!settings) return;
    const next: Record<string, EditableValue> = {};
    for (const setting of settings) {
      const value = setting.setting_value;
      if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
        next[setting.setting_key] = value;
      } else {
        next[setting.setting_key] = JSON.stringify(value);
      }
    }
    setDraft(next);
  }, [settings]);

  const dirtyKeys = useMemo(() => {
    if (!settings) return new Set<string>();
    const initial: Record<string, EditableValue> = {};
    for (const setting of settings) {
      const value = setting.setting_value;
      initial[setting.setting_key] =
        typeof value === "boolean" || typeof value === "number" || typeof value === "string"
          ? value
          : JSON.stringify(value);
    }
    const dirty = new Set<string>();
    for (const [key, value] of Object.entries(draft)) {
      if (initial[key] !== value) dirty.add(key);
    }
    return dirty;
  }, [settings, draft]);

  const saveMutation = useMutation({
    mutationFn: async (changes: { key: string; value: EditableValue; description: string | null }[]) => {
      const parsed = changes.map((change) => {
        const kind = settingMeta[change.key]?.kind;
        let value: unknown = change.value;
        if (kind === "number") { value = Number(change.value); if (Number.isNaN(value)) throw new Error(`"${change.key}" must be a number.`); }
        else if (kind === "json") { try { value = JSON.parse(String(change.value)); } catch { throw new Error(`"${change.key}" contains invalid JSON.`); } }
        return { key: change.key, value };
      });
      await api("/admin/settings", { method: "PATCH", body: JSON.stringify({ changes: parsed }) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
      toast.success("Settings saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!settings) return;
    const changes = settings
      .filter((s) => dirtyKeys.has(s.setting_key))
      .map((s) => ({ key: s.setting_key, value: draft[s.setting_key], description: s.description }));
    if (changes.length === 0) return;
    saveMutation.mutate(changes);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Couldn&apos;t load system settings</AlertTitle>
        <AlertDescription>{(error as Error)?.message}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
      </Alert>
    );
  }

  const ordered = [...(settings ?? [])].sort((a, b) => {
    const aKnown = a.setting_key in settingMeta ? 0 : 1;
    const bKnown = b.setting_key in settingMeta ? 0 : 1;
    return aKnown - bKnown || a.setting_key.localeCompare(b.setting_key);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {dirtyKeys.size > 0 ? `${dirtyKeys.size} unsaved change${dirtyKeys.size === 1 ? "" : "s"}` : "All changes saved"}
        </p>
        <div className="flex gap-2">
          {dirtyKeys.size > 0 && (
            <Button
              variant="ghost"
              onClick={() => settings && setDraft(Object.fromEntries(settings.map((s) => [s.setting_key, (typeof s.setting_value === "object" && s.setting_value !== null ? JSON.stringify(s.setting_value) : s.setting_value) as EditableValue])))}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={dirtyKeys.size === 0 || saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Save changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Platform configuration</CardTitle>
          <CardDescription>
            Global settings stored in the system_settings table. Values apply platform-wide after save.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {ordered.map((setting) => {
            const meta = settingMeta[setting.setting_key];
            const label = meta?.label ?? setting.setting_key;
            const description = setting.description ?? undefined;
            const value = draft[setting.setting_key];

            return (
              <div key={setting.id} className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <Label htmlFor={`setting-${setting.setting_key}`} className="font-medium">
                    {label}
                  </Label>
                  {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
                  {!meta && <p className="mt-0.5 text-xs text-amber-600">Unrecognized key — edited as JSON.</p>}
                </div>

                <div className="shrink-0">
                  {meta?.kind === "boolean" || (typeof setting.setting_value === "boolean" && !meta) ? (
                    <Switch
                      id={`setting-${setting.setting_key}`}
                      checked={Boolean(value)}
                      onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, [setting.setting_key]: checked }))}
                    />
                  ) : meta?.kind === "json" ? (
                    <textarea
                      id={`setting-${setting.setting_key}`}
                      className="min-h-[72px] w-72 rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={String(value ?? "")}
                      onChange={(e) => setDraft((prev) => ({ ...prev, [setting.setting_key]: e.target.value }))}
                    />
                  ) : (
                    <Input
                      id={`setting-${setting.setting_key}`}
                      type={meta?.kind === "number" ? "number" : "text"}
                      className="w-56"
                      value={String(value ?? "")}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          [setting.setting_key]: meta?.kind === "number" ? Number(e.target.value) : e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSystemSettings;
