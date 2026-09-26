import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CircleCheck,
  CircleX,
  Cloud,
  FileText,
  HardDrive,
  Mail,
  Newspaper,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getStats } from "@/services/admin";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const Stat: React.FC<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; hint?: string }> = ({
  label,
  value,
  icon: Icon,
  hint,
}) => (
  <Card>
    <CardContent className="flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-semibold">{value}</p>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </CardContent>
  </Card>
);

/** Platform overview: counts, health, usage trends and recent admin activity. */
const AdminDashboard: React.FC = () => {
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: getStats, refetchInterval: 60_000 });
  const data = stats.data;

  if (stats.isError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Could not load platform statistics</AlertTitle>
        <AlertDescription>{errorMessage(stats.error)}</AlertDescription>
      </Alert>
    );
  }

  const signups = data?.charts?.signups_by_day ?? [];
  const uploads = data?.charts?.uploads_by_day ?? [];
  const maxSignups = Math.max(...signups.map((item) => item.total), 1);
  const maxUploads = Math.max(...uploads.map((item) => item.total), 1);

  return (
    <div className="space-y-6">
      {data?.degraded ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Platform is degraded</AlertTitle>
          <AlertDescription>
            {data.health?.database === false ? "Database checks are failing. " : ""}
            {data.health?.storage === false ? "Object storage checks are failing. " : ""}
            Check the status page and recent errors.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[92px] w-full rounded-xl" />)
        ) : (
          <>
            <Stat label="Users" value={String(data?.userCount ?? 0)} icon={Users} />
            <Stat label="Files" value={String(data?.fileCount ?? 0)} icon={FileText} />
            <Stat label="Provider connections" value={String(data?.providerCount ?? 0)} icon={Cloud} />
            <Stat
              label="Managed storage"
              value={formatBytes(data?.metrics?.managed_storage_bytes ?? 0)}
              icon={HardDrive}
              hint={`${formatBytes(data?.metrics?.trash_bytes ?? 0)} in trash`}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active sessions" value={String(data?.metrics?.active_sessions ?? 0)} icon={Activity} />
        <Stat label="Queued emails" value={String(data?.metrics?.pending_emails ?? 0)} icon={Mail} />
        <Stat label="Failed webhooks (24h)" value={String(data?.metrics?.failed_webhooks_24h ?? 0)} icon={TriangleAlert} />
        <Stat label="Open tickets" value={String(data?.metrics?.open_tickets ?? 0)} icon={Newspaper} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sign-ups (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {signups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sign-ups recorded yet.</p>
            ) : (
              <div className="flex h-28 items-end gap-1">
                {signups.map((day) => (
                  <div
                    key={day.day}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${Math.max((day.total / maxSignups) * 100, 3)}%` }}
                    title={`${day.day}: ${day.total}`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Uploads (30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {uploads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No uploads recorded yet.</p>
            ) : (
              <div className="flex h-28 items-end gap-1">
                {uploads.map((day) => (
                  <div
                    key={day.day}
                    className="flex-1 rounded-t bg-sky-500/70"
                    style={{ height: `${Math.max((day.total / maxUploads) * 100, 3)}%` }}
                    title={`${day.day}: ${day.total} files (${formatBytes(day.bytes)})`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Plan mix</CardTitle>
            <CardDescription>Accounts per subscription tier.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(data?.metrics?.plans ?? []).map((row) => (
                <li key={row.plan} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{row.plan}</span>
                  <Badge variant="secondary">{row.total}</Badge>
                </li>
              ))}
              {(data?.metrics?.plans ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">No data yet.</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Health checks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Database (D1)", ok: data?.health?.database !== false },
              { label: "Object storage (R2)", ok: data?.health?.storage !== false },
            ].map((check) => (
              <div key={check.label} className="flex items-center justify-between text-sm">
                <span>{check.label}</span>
                <span className={cn("flex items-center gap-1.5", check.ok ? "text-emerald-600" : "text-destructive")}>
                  {check.ok ? <CircleCheck className="h-4 w-4" /> : <CircleX className="h-4 w-4" />}
                  {check.ok ? "Operational" : "Failing"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {stats.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : (data?.recentActivities?.length ?? 0) === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Nothing logged yet.</p>
          ) : (
            <ul className="divide-y">
              {data?.recentActivities.map((event) => (
                <li key={event.id} className="flex items-center gap-3 px-6 py-2.5 text-sm">
                  <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate capitalize">{event.action.replace(/[._]/g, " ")}</span>
                  <span className="hidden truncate text-xs text-muted-foreground sm:block">{event.actor_email ?? "system"}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelativeTime(event.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
