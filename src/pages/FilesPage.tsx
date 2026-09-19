import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Seo } from "@/components/common/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Upload,
  FolderPlus,
  Folder,
  File as FileIcon,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Search,
  MoreVertical,
  Download,
  Star,
  Trash2,
  Edit3,
  Grid,
  List,
  ChevronRight,
  Loader2,
  CloudOff,
  SearchX,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";
import {
  listFiles,
  getFolderPath,
  createFolder,
  uploadFile,
  deleteFile,
  renameFile,
  toggleStar,
  downloadFile,
  recordActivity,
  type SortBy,
  type SortDirection,
} from "@/services/files";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const fileIcon = (file: FileItem): React.ComponentType<{ className?: string }> => {
  if (file.is_folder) return Folder;
  const mime = file.mime_type ?? "";
  if (mime.startsWith("image/")) return Image;
  if (mime.startsWith("video/")) return Video;
  if (mime.startsWith("audio/")) return Music;
  if (mime.startsWith("text/") || mime.includes("pdf") || mime.includes("word") || mime.includes("document")) return FileText;
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("rar") || mime.includes("7z")) return Archive;
  return FileIcon;
};

interface UploadState {
  id: string;
  name: string;
  percent: number;
}

const FilesPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FileItem | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FileItem[]>([]);
  const [tab, setTab] = useState<"all" | "starred">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // dialogs
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderBusy, setNewFolderBusy] = useState(false);
  const [renameTarget, setRenameTarget] = useState<FileItem | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTargets, setDeleteTargets] = useState<FileItem[] | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const loadFolder = useCallback(
    async (folder: FileItem | null) => {
      setLoading(true);
      setError(null);
      try {
        const data = await listFiles(folder?.id ?? null, sortBy, sortDirection);
        setFiles(data);
        setCurrentFolder(folder);
        setSelected(new Set());
        if (folder) {
          const chain = await getFolderPath(folder.id);
          setBreadcrumbs(chain.slice(0, -1));
        } else {
          setBreadcrumbs([]);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [sortBy, sortDirection]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    void loadFolder(currentFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, sortBy, sortDirection]);

  const visibleFiles = useMemo(() => {
    let result = files;
    if (tab === "starred") result = result.filter((f) => f.is_starred);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.filename.toLowerCase().includes(q));
    }
    return result;
  }, [files, tab, searchQuery]);

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCreateFolder = async () => {
    if (newFolderBusy) return;
    setNewFolderBusy(true);
    try {
      const folder = await createFolder(newFolderName, currentFolder?.id ?? null);
      setFiles((prev) => [folder, ...prev]);
      setNewFolderOpen(false);
      setNewFolderName("");
      toast.success(`Folder "${folder.filename}" created`);
      void recordActivity("folder_created", "folder", folder.id, { filename: folder.filename });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setNewFolderBusy(false);
    }
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const items = Array.from(fileList);
    for (const file of items) {
      const uploadId = `${Date.now()}_${file.name}`;
      setUploads((prev) => [...prev, { id: uploadId, name: file.name, percent: 0 }]);
      try {
        const created = await uploadFile(file, currentFolder?.id ?? null, (progress) => {
          setUploads((prev) => prev.map((u) => (u.name === progress.fileName && u.percent < 100 ? { ...u, percent: progress.percent } : u)));
        });
        setFiles((prev) => [created, ...prev]);
        toast.success(`"${file.name}" uploaded`);
        void recordActivity("file_uploaded", "file", created.id, { filename: file.name, size: file.size });
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteTargets || deleteBusy) return;
    setDeleteBusy(true);
    try {
      for (const target of deleteTargets) {
        await deleteFile(target);
        void recordActivity("file_deleted", target.is_folder ? "folder" : "file", target.id, { filename: target.filename });
      }
      const ids = new Set(deleteTargets.map((t) => t.id));
      setFiles((prev) => prev.filter((f) => !ids.has(f.id)));
      setSelected(new Set());
      toast.success(deleteTargets.length === 1 ? `"${deleteTargets[0].filename}" deleted` : `${deleteTargets.length} items deleted`);
      setDeleteTargets(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      const updated = await renameFile(renameTarget, renameName);
      setFiles((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      toast.success("Renamed");
      setRenameTarget(null);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleStar = async (file: FileItem) => {
    // Optimistic update with rollback
    setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_starred: !f.is_starred } : f)));
    try {
      await toggleStar(file);
      void recordActivity("file_starred", "file", file.id, { filename: file.filename, starred: !file.is_starred });
    } catch (err) {
      setFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, is_starred: file.is_starred } : f)));
      toast.error((err as Error).message);
    }
  };

  const handleDownload = async (file: FileItem) => {
    try {
      await downloadFile(file);
      void recordActivity("file_downloaded", "file", file.id, { filename: file.filename });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const toggleSelected = (id: string, additive: boolean) => {
    setSelected((prev) => {
      const next = additive ? new Set(prev) : new Set<string>();
      if (prev.has(id) && additive) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openFile = (file: FileItem) => {
    if (file.is_folder) {
      void loadFolder(file);
    } else {
      void handleDownload(file);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  const busyUploading = uploads.length > 0;

  return (
    <div className="space-y-4">
      <Seo title="Files" description="CloudGather files" path="/files" noIndex />
      {/* Header row */}
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Files</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            One workspace for everything stored in your connected clouds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-label="Upload files"
            onChange={(e) => {
              void handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={busyUploading}>
            {busyUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="mr-2 h-4 w-4" aria-hidden="true" />}
            Upload
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setNewFolderName("");
              setNewFolderOpen(true);
            }}
          >
            <FolderPlus className="mr-2 h-4 w-4" aria-hidden="true" /> New folder
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "all" | "starred")}>
          <TabsList>
            <TabsTrigger value="all">All files</TabsTrigger>
            <TabsTrigger value="starred" className="gap-1.5">
              <Star className="h-3.5 w-3.5" aria-hidden="true" /> Starred
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              placeholder="Search this folder…"
              className="w-52 pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search files"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Sort: {sortBy === "name" ? "Name" : sortBy === "size" ? "Size" : "Date"}
                {sortDirection === "asc" ? " ↑" : " ↓"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["date", "name", "size"] as SortBy[]).map((option) => (
                <DropdownMenuItem key={option} onClick={() => setSortBy(option)}>
                  By {option === "date" ? "date" : option}
                  {sortBy === option && <span className="ml-auto text-xs text-muted-foreground">✓</span>}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}>
                {sortDirection === "asc" ? "Switch to descending" : "Switch to ascending"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex overflow-hidden rounded-md border" role="group" aria-label="View mode">
            <button
              type="button"
              className={cn("p-2", view === "list" ? "bg-muted" : "hover:bg-muted/60")}
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cn("p-2", view === "grid" ? "bg-muted" : "hover:bg-muted/60")}
              onClick={() => setView("grid")}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <Grid className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Upload progress */}
      {busyUploading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-2 p-4">
            {uploads.map((upload) => (
              <div key={upload.id} className="flex items-center gap-3 text-sm" aria-live="polite">
                <UploadCloud className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="w-40 truncate">{upload.name}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${upload.percent}%` }} />
                </div>
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{upload.percent}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Breadcrumbs */}
      {(currentFolder || breadcrumbs.length > 0) && (
        <nav aria-label="Folder" className="flex flex-wrap items-center gap-1 text-sm">
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void loadFolder(null)}>
            Home
          </Button>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => void loadFolder(crumb)}>
                {crumb.filename}
              </Button>
            </React.Fragment>
          ))}
          {currentFolder && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="px-2 font-medium" aria-current="page">
                {currentFolder.filename}
              </span>
            </>
          )}
        </nav>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CloudOff className="h-8 w-8 text-destructive" aria-hidden="true" />
            <p className="font-medium">Couldn&apos;t load this folder</p>
            <p className="max-w-md text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => void loadFolder(currentFolder)}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : visibleFiles.length === 0 ? (
        <div
          className={cn(
            "rounded-xl border-2 border-dashed p-14 text-center transition-colors",
            dragActive && "border-primary bg-primary/5"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void handleUpload(e.dataTransfer.files);
          }}
        >
          {searchQuery || tab === "starred" ? (
            <>
              <SearchX className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">
                {searchQuery ? `No results for "${searchQuery}"` : "Nothing starred yet"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchQuery ? "Try a different search term." : "Star files to find them quickly here."}
              </p>
            </>
          ) : (
            <>
              <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
              <h2 className="mt-4 font-semibold">This folder is empty</h2>
              <p className="mt-1 text-sm text-muted-foreground">Drop files here, or use the buttons above.</p>
              <div className="mt-5 flex justify-center gap-2">
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" /> Upload files
                </Button>
                <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
                  <FolderPlus className="mr-2 h-4 w-4" aria-hidden="true" /> Create folder
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div
          className={cn(
            "rounded-xl border bg-card",
            dragActive && "border-primary ring-2 ring-primary/30"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            void handleUpload(e.dataTransfer.files);
          }}
        >
          {view === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Files in {currentFolder?.filename ?? "your workspace"}</caption>
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={selected.size > 0 && selected.size === visibleFiles.length}
                        onCheckedChange={() =>
                          setSelected((prev) => (prev.size === visibleFiles.length ? new Set() : new Set(visibleFiles.map((f) => f.id))))
                        }
                        aria-label="Select all files"
                      />
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Name</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Size</th>
                    <th scope="col" className="hidden px-3 py-2.5 font-medium sm:table-cell">Modified</th>
                    <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((file) => {
                    const Icon = fileIcon(file);
                    return (
                      <tr
                        key={file.id}
                        className={cn(
                          "group cursor-pointer border-b transition-colors last:border-0 hover:bg-muted/50",
                          selected.has(file.id) && "bg-primary/5"
                        )}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest("[data-actions]")) return;
                          openFile(file);
                        }}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(file.id)}
                            onCheckedChange={() => toggleSelected(file.id, true)}
                            aria-label={`Select ${file.filename}`}
                          />
                        </td>
                        <td className="max-w-[240px] px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Icon className={cn("h-4.5 w-4.5 h-5 w-5 shrink-0", file.is_folder ? "fill-primary/15 text-primary" : "text-muted-foreground")} aria-hidden="true" />
                            <span className="truncate font-medium">{file.filename}</span>
                            {file.is_starred && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="Starred" />}
                          </div>
                        </td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                          {file.is_folder ? "—" : formatBytes(file.size)}
                        </td>
                        <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell">
                          {formatRelativeTime(file.updated_at)}
                        </td>
                        <td className="px-3 py-2.5 text-right" data-actions onClick={(e) => e.stopPropagation()}>
                          <FileRowMenu
                            file={file}
                            onStar={() => void handleStar(file)}
                            onDownload={() => void handleDownload(file)}
                            onRename={() => {
                              setRenameTarget(file);
                              setRenameName(file.filename);
                            }}
                            onDelete={() => setDeleteTargets([file])}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visibleFiles.map((file) => {
                const Icon = fileIcon(file);
                return (
                  <li key={file.id}>
                    <button
                      type="button"
                      className="group relative flex w-full flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => openFile(file)}
                    >
                      <span className="absolute left-2 top-2" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(file.id)}
                          onCheckedChange={() => toggleSelected(file.id, true)}
                          aria-label={`Select ${file.filename}`}
                        />
                      </span>
                      <span className="absolute right-1.5 top-1.5" onClick={(e) => e.stopPropagation()}>
                        <FileRowMenu
                          file={file}
                          onStar={() => void handleStar(file)}
                          onDownload={() => void handleDownload(file)}
                          onRename={() => {
                            setRenameTarget(file);
                            setRenameName(file.filename);
                          }}
                          onDelete={() => setDeleteTargets([file])}
                        />
                      </span>
                      <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted/70">
                        <Icon className={cn("h-7 w-7", file.is_folder ? "fill-primary/20 text-primary" : "text-muted-foreground")} aria-hidden="true" />
                      </span>
                      <span className="line-clamp-2 w-full break-all text-xs font-medium">{file.filename}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {file.is_folder ? "Folder" : formatBytes(file.size)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 mx-auto flex w-fit items-center gap-3 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="ghost" onClick={() => setDeleteTargets(files.filter((f) => selected.has(f.id)))}>
            <Trash2 className="mr-1.5 h-4 w-4 text-destructive" aria-hidden="true" /> Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateFolder();
            }}
          >
            <DialogHeader>
              <DialogTitle>New folder</DialogTitle>
              <DialogDescription>
                {currentFolder ? `Inside "${currentFolder.filename}"` : "In your workspace root"}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-2">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Documents"
                maxLength={255}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={newFolderBusy || !newFolderName.trim()}>
                {newFolderBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleRename();
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename</DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-2">
              <Label htmlFor="rename-name">New name</Label>
              <Input
                id="rename-name"
                autoFocus
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                maxLength={255}
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameName.trim()}>Rename</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTargets)} onOpenChange={(open) => !open && setDeleteTargets(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deleteTargets?.length === 1 ? `Delete "${deleteTargets[0].filename}"?` : `Delete ${deleteTargets?.length} items?`}
            </DialogTitle>
            <DialogDescription>
              {deleteTargets?.some((t) => t.is_folder)
                ? "Folders and everything inside them will be permanently deleted. This cannot be undone."
                : "This will permanently delete the selected items. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargets(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDelete()} disabled={deleteBusy}>
              {deleteBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** Per-row action menu (memoized child to keep list interactions snappy). */
const FileRowMenu: React.FC<{
  file: FileItem;
  onStar: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
}> = ({ file, onStar, onDownload, onRename, onDelete }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Actions for ${file.filename}`}>
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      {!file.is_folder && (
        <DropdownMenuItem onClick={onDownload}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Download
        </DropdownMenuItem>
      )}
      <DropdownMenuItem onClick={onStar}>
        <Star className={cn("mr-2 h-4 w-4", file.is_starred && "fill-amber-400 text-amber-400")} aria-hidden="true" />
        {file.is_starred ? "Remove star" : "Add star"}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onRename}>
        <Edit3 className="mr-2 h-4 w-4" aria-hidden="true" /> Rename
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
        <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export default FilesPage;
