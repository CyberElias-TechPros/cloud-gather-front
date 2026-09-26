import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getSettings, saveSettings, toggleMaintenance, type AdminSetting } from "@/services/admin";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

/** Groups a setting key such as `security.session_ttl_hours` by its prefix. */
const groupOf = (key: string) => (key.includes(".") ? key.split(".")[0] : "general");

const labelOf = (key: string) =>
  (key.includes(".") ? key.slice(key.indexOf(".") + 1) : key).replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());

type Draft = Record<string, unknown>;

const SettingField: React.FC<{
  setting: AdminSetting;
  value: unknown;
  onChange: (value: unknown) => void;
}> = ({ setting, value, onChange }) => {
  const id = `setting-${setting.setting_key}`;

  if (typeof value === "boolean") {
    return (
      <div className="flex items-start justify-between gap-4 py-3">
        <div className="space-y-0.5">
          <Label htmlFor={id}>{labelOf(setting.setting_key)}</Label>
          {setting.description ? <p className="text-xs text-muted-foreground">{setting.description}</p> : null}
        </div>
        <Switch id={id} checked={value} onCheckedChange={onChange} />
      </div>
    );
  }

  if (typeof value === "number") {
    return (
      <div className="space-y-1.5 py-3">
        <Label htmlFor={id}>{labelOf(setting.setting_key)}</Label>
        <Input id={id} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        {setting.description ? <p className="text-xs text-muted-foreground">{setting.description}</p> : null}
      </div>
    );
  }

  if (typeof value === "string") {
    const multiline = value.length > 60 || value.includes("\n");
    return (
      <div className="space-y-1.5 py-3">
        <Label htmlFor={id}>{labelOf(setting.setting_key)}</Label>
        {multiline ? (
          <Textarea id={id} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
        ) : (
          <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
        )}
        {setting.description ? <p className="text-xs text-muted-foreground">{setting.description}</p> : null}
      </div>
    );
  }

  // Arrays and objects are edited as JSON.
  return (
    <div className="space-y-1.5 py-3">
      <Label htmlFor={id}>{labelOf(setting.setting_key)}</Label>
      <Textarea
        id={id}
        rows={3}
        className="font-mono text-xs"
        defaultValue={JSON.stringify(value, null, 2)}
        onBlur={(event) => {
          try {
            onChange(JSON.parse(event.target.value));
          } catch {
            toast.error(`${setting.setting_key} must be valid JSON`);
          }
        }}
      />
      {setting.description ? <p className="text-xs text-muted-foreground">{setting.description}</p> : null}
    </div>
  );
};

/** Editor for the platform_settings table, grouped by key prefix. */
const AdminSystemSettings: React.FC = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<Draft>({});

  const settings = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettings });

  const changes = React.useMemo(
    () =>
      (settings.data ?? [])
        .filter((setting) => setting.setting_key in draft && JSON.stringify(draft[setting.setting_key]) !== JSON.stringify(setting.setting_value))
        .map((setting) => ({ key: setting.setting_key, value: draft[setting.setting_key] })),
    [draft, settings.data],
  );

  const save = useMutation({
    mutationFn: () => saveSettings(changes),
    onSuccess: () => {
      toast.success(`${changes.length} setting(s) saved`);
      setDraft({});
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const maintenanceSetting = (settings.data ?? []).find((setting) => setting.setting_key.endsWith("maintenance_mode"));
  const maintenanceOn = Boolean(maintenanceSetting?.setting_value);

  const maintenance = useMutation({
    mutationFn: (enabled: boolean) => toggleMaintenance(enabled),
    onSuccess: (data) => {
      toast.success(data.maintenance_mode ? "Maintenance mode enabled" : "Maintenance mode disabled");
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const groups = React.useMemo(() => {
    const map = new Map<string, AdminSetting[]>();
    for (const setting of settings.data ?? []) {
      const group = groupOf(setting.setting_key);
      map.set(group, [...(map.get(group) ?? []), setting]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [settings.data]);

  if (settings.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 w-full rounded-xl" />)}
      </div>
    );
  }

  if (settings.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Could not load settings</AlertTitle>
        <AlertDescription>{errorMessage(settings.error)}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      <Card className={maintenanceOn ? "border-destructive" : undefined}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            Maintenance mode
            {maintenanceOn ? <Badge variant="destructive">Active</Badge> : null}
          </CardTitle>
          <CardDescription>
            Blocks non-admin API writes and shows a banner across the app. Use during migrations or incidents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant={maintenanceOn ? "destructive" : "outline"}
            disabled={maintenance.isPending}
            onClick={() => maintenance.mutate(!maintenanceOn)}
          >
            {maintenance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {maintenanceOn ? "Disable maintenance mode" : "Enable maintenance mode"}
          </Button>
        </CardContent>
      </Card>

      {groups.map(([group, items]) => (
        <Card key={group}>
          <CardHeader className="pb-1">
            <CardTitle className="text-base capitalize">{group.replace(/_/g, " ")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {items.map((setting) => (
              <SettingField
                key={setting.setting_key}
                setting={setting}
                value={setting.setting_key in draft ? draft[setting.setting_key] : setting.setting_value}
                onChange={(value) => setDraft((current) => ({ ...current, [setting.setting_key]: value }))}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {changes.length > 0 ? (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <p className="text-sm">
            <strong>{changes.length}</strong> unsaved change{changes.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
              <RotateCcw className="mr-2 h-4 w-4" /> Discard
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminSystemSettings;
