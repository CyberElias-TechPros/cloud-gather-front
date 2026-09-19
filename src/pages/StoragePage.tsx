import React, { useEffect, useMemo, useState } from "react";
import { Seo } from "@/components/common/Seo";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HardDrive,
  Folder,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  FileText,
  File as FileIcon,
  AlertTriangle,
  CloudUpload,
  ArrowRight,
} from "lucide-react";
import { listAllFiles, listProviders, type StorageProvider } from "@/services/files";
import type { FileItem } from "@/types/file";
import { formatBytes, formatPercent } from "@/lib/format";
import { getProviderIcon, getProviderName } from "@/lib/providers";

interface TypeBucket {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
  size: number;
}

const StoragePage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [providers, setProviders] = useState<StorageProvider[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [fileRows, providerRows] = await Promise.all([listAllFiles(), listProviders()]);
        if (cancelled) return;
        setFiles(fileRows);
        setProviders(providerRows);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const connected = providers.filter((p) => p.status === "connected");
  const cloudFiles = files.filter((f) => !f.is_folder);
  const usedBytes = cloudFiles.reduce((acc, f) => acc + (f.size || 0), 0);
  const totalBytes = connected.reduce((acc, p) => acc + (p.total_space || 0), 0);
  const providerUsed = connected.reduce((acc, p) => acc + (p.used_space || 0), 0);
  const usagePercent = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;

  const buckets = useMemo<TypeBucket[]>(() => {
    const defs: (Omit<TypeBucket, "count" | "size"> & { match: (f: FileItem) => boolean })[] = [
      { key: "image", label: "Images", icon: ImageIcon, match: (f) => (f.mime_type ?? "").startsWith("image/") },
      { key: "video", label: "Videos", icon: Video, match: (f) => (f.mime_type ?? "").startsWith("video/") },
      { key: "audio", label: "Audio", icon: Music, match: (f) => (f.mime_type ?? "").startsWith("audio/") },
      {
        key: "archive",
        label: "Archives",
        icon: Archive,
        match: (f) => /zip|compressed|rar|7z|tar/.test(f.mime_type ?? ""),
      },
      {
        key: "document",
        label: "Documents",
        icon: FileText,
        match: (f) =>
          (f.mime_type ?? "").startsWith("text/") ||
          /pdf|word|document|sheet|presentation|msword|excel|powerpoint/.test(f.mime_type ?? ""),
      },
    ];
    const result = defs.map((def) => {
      const matched = cloudFiles.filter(def.match);
      return {
        ...def,
        count: matched.length,
        size: matched.reduce((acc, f) => acc + (f.size || 0), 0),
      };
    });
    const others = cloudFiles.filter(
      (f) => !defs.some((def) => def.match(f))
    );
    result.push({
      key: "other",
      label: "Other",
      icon: FileIcon,
      match: () => false,
      count: others.length,
      size: others.reduce((acc, f) => acc + (f.size || 0), 0),
    });
    return result.filter((b) => b.count > 0);
  }, [cloudFiles]);

  const totalFolders = files.filter((f) => f.is_folder).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="font-medium">Couldn&apos;t load storage information</p>
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Seo title="Storage" description="CloudGather storage" path="/storage" noIndex />
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Storage</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Usage across your CloudGather uploads and connected providers.
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold">{formatBytes(usedBytes)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {totalBytes > 0
                  ? `of ${formatBytes(totalBytes)} pooled quota (${formatPercent(usedBytes, totalBytes)})`
                  : `across ${cloudFiles.length.toLocaleString()} files`}
              </p>
            </div>
            <div className="flex gap-6 text-right text-sm">
              <div>
                <p className="font-semibold">{cloudFiles.length.toLocaleString()}</p>
                <p className="text-muted-foreground">files</p>
              </div>
              <div>
                <p className="font-semibold">{totalFolders.toLocaleString()}</p>
                <p className="text-muted-foreground">folders</p>
              </div>
              <div>
                <p className="font-semibold">{connected.length}</p>
                <p className="text-muted-foreground">providers</p>
              </div>
            </div>
          </div>
          <div
            className="mt-5 h-3 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={usagePercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Storage used"
          >
            <div
              className={`h-full rounded-full transition-all ${usagePercent > 90 ? "bg-destructive" : "bg-gradient-to-r from-primary to-accent"}`}
              style={{ width: `${Math.max(usagePercent, usedBytes > 0 ? 2 : 0)}%` }}
            />
          </div>
          {usagePercent > 90 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              You&apos;re above 90% of your pooled quota — consider cleaning up or adding another provider.
            </p>
          )}
          {connected.length === 0 && (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                No providers connected yet — connect one to pool its quota and browse its files.
              </p>
              <Button size="sm" asChild>
                <Link to="/providers">
                  <CloudUpload className="mr-2 h-4 w-4" aria-hidden="true" /> Connect provider
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Per-provider */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" /> By provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            {connected.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Connect a provider to see its quota here.</p>
            ) : (
              <ul className="space-y-4">
                {connected.map((provider) => {
                  const Icon = getProviderIcon(provider.provider_name);
                  const pTotal = provider.total_space ?? 0;
                  const pUsed = provider.used_space ?? 0;
                  const pct = pTotal > 0 ? Math.round((pUsed / pTotal) * 100) : 0;
                  return (
                    <li key={provider.id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <Icon className={`h-4 w-4 ${"text-muted-foreground"}`} aria-hidden="true" />
                          {getProviderName(provider.provider_name)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {pTotal > 0 ? `${formatBytes(pUsed)} / ${formatBytes(pTotal)}` : formatBytes(pUsed)}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${pct > 90 ? "bg-destructive" : "bg-primary/70"}`}
                          style={{ width: `${Math.max(Math.min(pct, 100), 1)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
                {providerUsed > usedBytes && (
                  <li className="text-xs text-muted-foreground">
                    Provider quotas include files stored outside CloudGather, so provider usage can exceed the
                    CloudGather total.
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* By type */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Folder className="h-4 w-4 text-primary" aria-hidden="true" /> By file type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cloudFiles.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Upload files to see the breakdown here.</p>
            ) : (
              <ul className="space-y-3">
                {buckets.map((bucket) => (
                  <li key={bucket.key} className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <bucket.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{bucket.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {bucket.count} file{bucket.count === 1 ? "" : "s"} · {formatBytes(bucket.size)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-accent/70"
                          style={{ width: `${Math.max((bucket.size / Math.max(usedBytes, 1)) * 100, 1)}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="ghost" size="sm" className="mt-4" asChild>
              <Link to="/files">
                Manage files <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StoragePage;
