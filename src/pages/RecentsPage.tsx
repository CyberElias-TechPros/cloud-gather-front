import React, { useEffect, useMemo, useState } from "react";
import { Seo } from "@/components/common/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  Search,
  MoreVertical,
  Download,
  Star,
  Trash2,
  File as FileIcon,
  Image,
  Video,
  Music,
  Archive,
  FileText,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";
import { listAllFiles, downloadFile, toggleStar, deleteFile, recordActivity } from "@/services/files";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const fileIcon = (file: FileItem): React.ComponentType<{ className?: string }> => {
  if (file.is_folder) return FolderOpen;
  const mime = file.mime_type ?? "";
  if (mime.startsWith("image/")) return Image;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Music;
  if (/zip|compressed|rar|7z|tar/.test(mime)) return Archive;
  if (mime.startsWith("text/") || /pdf|word|document|sheet|presentation/.test(mime)) return FileText;
  return FileIcon;
};

/** Recents: the most recently modified files across all providers. */
const RecentsPage: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listAllFiles("date", "desc");
        if (cancelled) return;
        setFiles(rows.filter((f) => !f.is_folder));
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

  const grouped = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q ? files.filter((f) => f.filename.toLowerCase().includes(q)) : files;
    const groups: { label: string; items: FileItem[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "This week", items: [] },
      { label: "Earlier", items: [] },
    ];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;

    for (const file of filtered) {
      const ts = new Date(file.updated_at).getTime();
      if (ts >= startOfToday) groups[0].items.push(file);
      else if (ts >= startOfYesterday) groups[1].items.push(file);
      else if (ts >= startOfWeek) groups[2].items.push(file);
      else groups[3].items.push(file);
    }
    return groups.filter((g) => g.items.length > 0);
  }, [files, searchQuery]);

  const handleDownload = async (file: FileItem) => {
    setDownloadingId(file.id);
    try {
      await downloadFile(file);
      void recordActivity("file_downloaded", "file", file.id, { filename: file.filename });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleStar = async (file: FileItem) => {
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_starred: !f.is_starred } : f)));
    try {
      await toggleStar(file);
    } catch (err) {
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_starred: file.is_starred } : f)));
      toast.error((err as Error).message);
    }
  };

  const handleDelete = async (file: FileItem) => {
    try {
      await deleteFile(file);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      void recordActivity("file_deleted", "file", file.id, { filename: file.filename });
      toast.success(`"${file.filename}" deleted`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-44" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="font-medium">Couldn&apos;t load recent files</p>
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
          <button className="text-sm font-medium text-primary underline-offset-2 hover:underline" onClick={() => window.location.reload()}>
            Reload
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Seo title="Recents" description="CloudGather recents" path="/recents" noIndex />
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="h-6 w-6 text-primary" aria-hidden="true" /> Recents
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Files you&apos;ve changed most recently.</p>
        </div>
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search recents…"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search recent files"
          />
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-14 text-center">
          <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
          <h2 className="mt-4 font-semibold">{searchQuery ? "No matches" : "No recent files yet"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery ? "Try a different search term." : "Files you upload or modify will appear here."}
          </p>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
            <div className="overflow-hidden rounded-xl border bg-card">
              <ul>
                {group.items.map((file) => {
                  const Icon = fileIcon(file);
                  return (
                    <li key={file.id} className="border-b last:border-0">
                      <div
                        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                        onClick={() => void handleDownload(file)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void handleDownload(file);
                          }
                        }}
                        aria-label={`${file.filename}, ${formatBytes(file.size)}, modified ${formatRelativeTime(file.updated_at)}. Press Enter to download.`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <Icon className="h-4.5 w-4.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-2 truncate text-sm font-medium">
                            {file.filename}
                            {file.is_starred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(file.size)} · {formatRelativeTime(file.updated_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {downloadingId === file.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                          ) : null}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                                aria-label={`Actions for ${file.filename}`}
                              >
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => void handleDownload(file)}>
                                <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Download
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleStar(file)}>
                                <Star className={cn("mr-2 h-4 w-4", file.is_starred && "fill-amber-400 text-amber-400")} aria-hidden="true" />
                                {file.is_starred ? "Remove star" : "Add star"}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleDelete(file)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        ))
      )}
    </div>
  );
};

export default RecentsPage;
