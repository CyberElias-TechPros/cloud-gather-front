import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Cloud, HardDrive, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFileStats } from "@/services/files";
import { listConnections } from "@/services/providers";
import { formatBytes } from "@/lib/format";
import { categoryIcon, KIND_LABELS } from "@/lib/fileIcons";
import { getProviderIcon, getProviderName } from "@/lib/providers";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

const BAR_COLOURS = [
  "bg-primary",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-slate-400",
];

/** Where every byte lives: plan usage, categories and per-provider totals. */
const StoragePage: React.FC = () => {
  const stats = useQuery({ queryKey: ["file-stats"], queryFn: getFileStats });
  const providers = useQuery({ queryKey: ["providers"], queryFn: listConnections });

  const usage = stats.data?.usage;
  const limits = stats.data?.limits;
  const percent = stats.data?.storage_percent ?? 0;
  const categories = (stats.data?.by_category ?? []).slice().sort((a, b) => b.bytes - a.bytes);
  const totalCategorised = categories.reduce((sum, item) => sum + item.bytes, 0) || 1;

  return (
    <div className="space-y-6">
      <Seo title="Storage" description="Storage usage across CloudGather and your connected drives." path="/storage" noIndex />
      <PageHeader
        title="Storage"
        icon={HardDrive}
        description="Understand what's using your space and where it lives."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/trash">
                <Trash2 className="mr-2 h-4 w-4" /> Trash
              </Link>
            </Button>
            <Button asChild>
              <Link to="/billing">
                <Sparkles className="mr-2 h-4 w-4" /> Upgrade
              </Link>
            </Button>
          </>
        }
      />

      {stats.isError ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Could not load storage information</AlertTitle>
          <AlertDescription>{errorMessage(stats.error)}</AlertDescription>
        </Alert>
      ) : null}

      {/* Plan usage */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>
                {stats.isLoading ? <Skeleton className="h-6 w-40" /> : `${formatBytes(usage?.storageBytes ?? 0)} used`}
              </CardTitle>
              <CardDescription>
                of {formatBytes(limits?.storageBytes ?? 0)} on the {stats.data?.plan?.name ?? "Free"} plan
              </CardDescription>
            </div>
            <Badge variant={percent >= 90 ? "destructive" : percent >= 75 ? "secondary" : "outline"}>
              {percent.toFixed(1)}% full
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={Math.min(percent, 100)} className="h-2.5" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Files", value: String(usage?.fileCount ?? 0) },
              { label: "Folders", value: String(usage?.folderCount ?? 0) },
              { label: "In trash", value: formatBytes(usage?.trashBytes ?? 0) },
              { label: "Connected drives", value: String(usage?.providerCount ?? 0) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
          {percent >= 80 ? (
            <Alert>
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>Running low on space</AlertTitle>
              <AlertDescription>
                Empty the <Link className="underline" to="/trash">trash</Link> or{" "}
                <Link className="underline" to="/billing">move to a larger plan</Link>.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* By category */}
        <Card>
          <CardHeader>
            <CardTitle>By file type</CardTitle>
            <CardDescription>What is taking up the most room.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : categories.length === 0 ? (
              <EmptyState className="border-0 py-8" icon={HardDrive} title="Nothing stored yet" />
            ) : (
              <>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                  {categories.map((item, index) => (
                    <span
                      key={item.category}
                      className={cn("h-full", BAR_COLOURS[index % BAR_COLOURS.length])}
                      style={{ width: `${(item.bytes / totalCategorised) * 100}%` }}
                      title={`${item.category}: ${formatBytes(item.bytes)}`}
                    />
                  ))}
                </div>
                <ul className="space-y-2">
                  {categories.map((item, index) => {
                    const Icon = categoryIcon(item.category);
                    return (
                      <li key={item.category} className="flex items-center gap-3 text-sm">
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", BAR_COLOURS[index % BAR_COLOURS.length])} />
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate">{KIND_LABELS[item.category] ?? item.category}</span>
                        <span className="text-muted-foreground">{item.files} files</span>
                        <span className="w-20 text-right font-medium">{formatBytes(item.bytes)}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </CardContent>
        </Card>

        {/* By provider */}
        <Card>
          <CardHeader>
            <CardTitle>By location</CardTitle>
            <CardDescription>CloudGather storage plus every connected drive.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.isLoading || providers.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <ul className="space-y-3">
                {(stats.data?.by_provider ?? []).map((row) => {
                  const Icon = row.provider_name ? getProviderIcon(row.provider_name) : HardDrive;
                  return (
                    <li key={row.provider_id ?? "managed"} className="flex items-center gap-3">
                      <Icon className="h-6 w-6 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {row.provider_name ? getProviderName(row.provider_name) : "CloudGather storage"}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.items} items</p>
                      </div>
                      <span className="text-sm font-medium">{formatBytes(row.bytes)}</span>
                    </li>
                  );
                })}
                {(providers.data ?? []).length === 0 ? (
                  <li>
                    <EmptyState
                      className="border-0 py-6"
                      icon={Cloud}
                      title="No drives connected"
                      description="Connect Google Drive, Dropbox, OneDrive, S3 and more."
                      action={
                        <Button size="sm" asChild>
                          <Link to="/providers">Connect a drive</Link>
                        </Button>
                      }
                    />
                  </li>
                ) : (
                  providers.data?.map((provider) => {
                    const used = provider.used_space ?? 0;
                    const total = provider.total_space ?? 0;
                    const Icon = getProviderIcon(provider.provider_name);
                    return (
                      <li key={provider.id} className="space-y-1 rounded-lg border p-3">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {provider.display_name || getProviderName(provider.provider_name)}
                          </span>
                          <Badge variant={provider.status === "error" ? "destructive" : "secondary"}>{provider.status}</Badge>
                        </div>
                        {total > 0 ? (
                          <>
                            <Progress value={Math.min((used / total) * 100, 100)} className="h-1.5" />
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(used)} of {formatBytes(total)} on the provider
                            </p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">{provider.file_count} files indexed</p>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent uploads trend */}
      {stats.data?.recent_uploads?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Uploads over the last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-32 items-end gap-1">
              {stats.data.recent_uploads.map((day) => {
                const max = Math.max(...stats.data!.recent_uploads!.map((item) => item.bytes), 1);
                return (
                  <div
                    key={day.day}
                    className="flex-1 rounded-t bg-primary/70"
                    style={{ height: `${Math.max((day.bytes / max) * 100, 2)}%` }}
                    title={`${day.day}: ${formatBytes(day.bytes)} (${day.files} files)`}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};

export default StoragePage;
