import React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, CircleX, RefreshCw } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo } from "@/components/common/Seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatus } from "@/services/system";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_META = {
  operational: { label: "All systems operational", icon: CheckCircle2, className: "text-emerald-500" },
  degraded: { label: "Degraded performance", icon: CircleAlert, className: "text-amber-500" },
  outage: { label: "Service disruption", icon: CircleX, className: "text-destructive" },
} as const;

/** Public service status page fed by the API's health checks and incidents. */
const StatusPage: React.FC = () => {
  const status = useQuery({ queryKey: ["status"], queryFn: getStatus, refetchInterval: 60_000 });
  const overall = STATUS_META[status.data?.status ?? "operational"];
  const OverallIcon = overall.icon;

  return (
    <MarketingLayout>
      <Seo
        title="System status"
        description="Live availability of the CloudGather API, storage and integrations."
        path="/status"
      />
      <div className="container max-w-3xl space-y-8 px-4 py-14 sm:px-6">
        <div className="text-center">
          <OverallIcon className={cn("mx-auto h-12 w-12", overall.className)} />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{overall.label}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status.data?.updated_at ? `Last checked ${formatRelativeTime(status.data.updated_at)}` : "Checking…"}
          </p>
          <Button variant="ghost" size="sm" className="mt-3" onClick={() => status.refetch()} disabled={status.isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", status.isFetching && "animate-spin")} /> Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Components</CardTitle>
            <CardDescription>Each subsystem is probed directly by the API.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {status.isLoading ? (
              <div className="space-y-2 p-6">
                {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
              </div>
            ) : (
              <ul className="divide-y">
                {status.data?.components.map((component) => {
                  const meta = STATUS_META[component.status];
                  const Icon = meta.icon;
                  return (
                    <li key={component.id} className="flex items-center justify-between gap-3 px-6 py-3">
                      <span className="font-medium">{component.name}</span>
                      <span className={cn("flex items-center gap-2 text-sm", meta.className)}>
                        <Icon className="h-4 w-4" />
                        <span className="capitalize">{component.status}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Incidents &amp; maintenance</CardTitle>
            <CardDescription>Published updates from the CloudGather team.</CardDescription>
          </CardHeader>
          <CardContent>
            {(status.data?.incidents?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No incidents reported. Everything is running smoothly.</p>
            ) : (
              <ul className="space-y-4">
                {status.data?.incidents.map((incident) => (
                  <li key={incident.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          incident.level === "critical" ? "destructive" : incident.level === "warning" ? "secondary" : "outline"
                        }
                        className="capitalize"
                      >
                        {incident.level}
                      </Badge>
                      <h3 className="font-medium">{incident.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{incident.body}</p>
                    {incident.starts_at ? (
                      <p className="mt-2 text-xs text-muted-foreground">Started {formatDateTime(incident.starts_at)}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {status.data?.metrics && Object.keys(status.data.metrics).length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Platform metrics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {Object.entries(status.data.metrics).map(([key, value]) => (
                <div key={key} className="rounded-lg border p-4 text-center">
                  <p className="text-2xl font-semibold">{typeof value === "number" ? value.toLocaleString() : String(value)}</p>
                  <p className="text-xs capitalize text-muted-foreground">{key.replace(/_/g, " ")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </MarketingLayout>
  );
};

export default StatusPage;
