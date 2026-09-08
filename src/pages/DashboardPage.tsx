import React, { useEffect, useState } from "react";
import { Seo } from "@/components/common/Seo";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  listAllFiles,
  listProviders,
  listActivity,
  type ActivityEvent,
  type StorageProvider,
} from "@/services/files";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { getProviderIcon, getProviderName } from "@/lib/providers";
import {
  Files,
  HardDrive,
  Cloud,
  Share2,
  Upload,
  Download,
  Share,
  Star,
  FolderPlus,
  Trash2,
  CloudUpload,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

interface Stats {
  totalFiles: number;
  totalFolders: number;
  usedStorage: number;
  totalStorage: number;
  connectedProviders: number;
  sharedFiles: number;
  starredFiles: number;
}

const actionIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  file_uploaded: Upload,
  file_downloaded: Download,
  file_shared: Share,
  file_starred: Star,
  folder_created: FolderPlus,
  file_deleted: Trash2,
};

const actionLabels: Record<string, string> = {
  file_uploaded: "Uploaded",
  file_downloaded: "Downloaded",
  file_shared: "Shared",
  file_starred: "Starred",
  folder_created: "Created folder",
  file_deleted: "Deleted",
  provider_connected: "Connected provider",
  provider_disconnected: "Disconnected provider",
};

const DashboardPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalFiles: 0,
    totalFolders: 0,
    usedStorage: 0,
    totalStorage: 0,
    connectedProviders: 0,
    sharedFiles: 0,
    starredFiles: 0,
  });
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [providers, setProviders] = useState<StorageProvider[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [files, providerRows, activityRows] = await Promise.all([
          listAllFiles(),
          listProviders(),
          listActivity(8).catch(() => [] as ActivityEvent[]),
        ]);
        if (cancelled) return;
        const connected = providerRows.filter((p) => p.status === "connected");
        setStats({
          totalFiles: files.filter((f) => !f.is_folder).length,
          totalFolders: files.filter((f) => f.is_folder).length,
          usedStorage: files.reduce((acc, f) => acc + (f.size || 0), 0),
          totalStorage: connected.reduce((acc, p) => acc + (p.total_space || 0), 0),
          connectedProviders: connected.length,
          sharedFiles: files.filter((f) => f.is_shared).length,
          starredFiles: files.filter((f) => f.is_starred).length,
        });
        setProviders(connected);
        setActivity(activityRows);
      } catch (err) {
        if (!cancelled) setError((err as Error).message || "Failed to load your dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const firstName = (profile?.display_name || user?.email?.split("@")[0] || "there").split(" ")[0];
  const usagePercent = stats.totalStorage > 0 ? Math.min(100, Math.round((stats.usedStorage / stats.totalStorage) * 100)) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="font-medium">Couldn&apos;t load your dashboard</p>
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Seo title="Dashboard" description="CloudGather dashboard" path="/dashboard" noIndex />
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stats.totalFiles === 0
              ? "Your workspace is ready — connect a provider or upload your first file."
              : `You have ${stats.totalFiles.toLocaleString()} file${stats.totalFiles === 1 ? "" : "s"} across ${stats.connectedProviders} connected provider${stats.connectedProviders === 1 ? "" : "s"}.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/providers">
              <CloudUpload className="mr-2 h-4 w-4" aria-hidden="true" /> Connect provider
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/files">Browse files</Link>
          </Button>
        </div>
      </header>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Storage summary">
        {[
          { icon: Files, label: "Files", value: stats.totalFiles.toLocaleString(), sub: `${stats.totalFolders} folders` },
          { icon: HardDrive, label: "Storage used", value: formatBytes(stats.usedStorage), sub: stats.totalStorage > 0 ? `${usagePercent}% of ${formatBytes(stats.totalStorage)}` : "across providers" },
          { icon: Cloud, label: "Providers", value: String(stats.connectedProviders), sub: stats.connectedProviders === 0 ? "none connected yet" : "connected" },
          { icon: Share2, label: "Shared", value: String(stats.sharedFiles), sub: `${stats.starredFiles} starred` },
        ].map((card) => (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <card.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="truncate text-xl font-bold">{card.value}</p>
                <p className="truncate text-xs text-muted-foreground">{card.sub}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.totalStorage > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pool usage — {formatBytes(stats.usedStorage)} of {formatBytes(stats.totalStorage)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={usagePercent} aria-valuemin={0} aria-valuemax={100}>
              <div
                className={`h-full rounded-full transition-all ${usagePercent > 90 ? "bg-destructive" : "bg-gradient-to-r from-primary to-accent"}`}
                style={{ width: `${Math.max(usagePercent, 1)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent activity */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No activity yet. Upload a file or connect a provider to get started.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.map((event) => {
                  const Icon = actionIcons[event.action] ?? Files;
                  const details = (event.details ?? {}) as { filename?: string; provider?: string };
                  return (
                    <li key={event.id} className="flex items-center gap-3 text-sm">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{actionLabels[event.action] ?? event.action}</span>
                        {details.filename && <span className="text-muted-foreground"> · {details.filename}</span>}
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={event.created_at}>
                        {formatRelativeTime(event.created_at)}
                      </time>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Connected providers */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Connected providers</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/providers">
                Manage <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {providers.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No providers connected yet. Connect Google Drive, Dropbox or S3 to see all your files here.
                </p>
                <Button className="mt-4" variant="outline" asChild>
                  <Link to="/providers">
                    Connect your first provider <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {providers.slice(0, 6).map((provider) => {
                  const Icon = getProviderIcon(provider.provider_name);
                  const used = provider.used_space ?? 0;
                  const total = provider.total_space ?? 0;
                  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
                  return (
                    <li key={provider.id} className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 shrink-0 ${"text-muted-foreground"}`} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between text-sm">
                          <span className="truncate font-medium">{getProviderName(provider.provider_name)}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {total > 0 ? `${formatBytes(used)} / ${formatBytes(total)}` : formatBytes(used)}
                          </span>
                        </div>
                        {total > 0 && (
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max(pct, 1)}%` }} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
