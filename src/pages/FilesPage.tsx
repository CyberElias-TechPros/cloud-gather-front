import React from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Copy,
  Download,
  Edit3,
  FileUp,
  FolderPlus,
  Grid,
  Home,
  Info,
  List,
  Loader2,
  MoreVertical,
  Move,
  Search,
  SearchX,
  Share2,
  Star,
  Trash2,
  TriangleAlert,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareDialog } from "@/components/files/ShareDialog";
import { MoveDialog } from "@/components/files/MoveDialog";
import { PreviewDialog } from "@/components/files/PreviewDialog";
import { FileDetailsSheet } from "@/components/files/FileDetailsSheet";
import {
  bulkAction,
  copyFile,
  createFolder,
  deleteFile,
  downloadFile,
  getFile,
  getFolderPath,
  moveFile,
  queryFiles,
  renameFile,
  searchFiles,
  toggleStar,
  uploadFile,
  type SortBy,
  type SortDirection,
} from "@/services/files";
import { useAppConfig } from "@/hooks/useAppConfig";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { fileIconFor } from "@/lib/fileIcons";
import { getProviderName } from "@/lib/providers";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";

interface UploadTask {
  id: string;
  name: string;
  size: number;
  percent: number;
  status: "uploading" | "done" | "error" | "cancelled";
  error?: string;
  controller: AbortController;
}

const CATEGORIES = ["image", "video", "audio", "document", "spreadsheet", "presentation", "archive", "code", "other"];

/** Validates a folder or file name before hitting the API. */
export function validateName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("A name is required.");
  if (trimmed.length > 255) throw new Error("That name is too long (max 255 characters).");
  if (/[/\\]/.test(trimmed)) throw new Error("Names cannot contain slashes.");
  return trimmed;
}

const FilesPage: React.FC = () => {
  const { folderId = null } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: config } = useAppConfig();

  const [search, setSearch] = React.useState(params.get("q") ?? "");
  const [debounced, setDebounced] = React.useState(search);
  const [filter, setFilter] = React.useState<"" | "starred" | "shared" | "folders">(
    (params.get("filter") as "starred" | "shared" | "folders" | null) ?? "",
  );
  const [category, setCategory] = React.useState(params.get("category") ?? "");
  const [sortBy, setSortBy] = React.useState<SortBy>("name");
  const [direction, setDirection] = React.useState<SortDirection>("asc");
  const [view, setView] = React.useState<"list" | "grid">(() => {
    try {
      return (window.localStorage.getItem("cg:files-view") as "list" | "grid") || "list";
    } catch {
      return "list";
    }
  });

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [uploads, setUploads] = React.useState<UploadTask[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const folderInputRef = React.useRef<HTMLInputElement>(null);

  const [newFolderOpen, setNewFolderOpen] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState<FileItem | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [deleteTargets, setDeleteTargets] = React.useState<FileItem[] | null>(null);
  const [shareTarget, setShareTarget] = React.useState<FileItem | null>(null);
  const [detailsTarget, setDetailsTarget] = React.useState<FileItem | null>(null);
  const [previewTarget, setPreviewTarget] = React.useState<FileItem | null>(null);
  const [moveState, setMoveState] = React.useState<{ items: FileItem[]; mode: "move" | "copy" } | null>(null);

  /* ------------------------------------------------------------ queries */

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem("cg:files-view", view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const searching = debounced.length > 1;

  const listing = useQuery({
    queryKey: ["files", folderId, sortBy, direction, filter, category],
    queryFn: () =>
      queryFiles({
        parentId: folderId,
        sortBy,
        direction,
        filter: filter || undefined,
        category: category || undefined,
        limit: 200,
      }),
    enabled: !searching,
  });

  const searchResults = useQuery({
    queryKey: ["files", "search", debounced, category, filter],
    queryFn: () =>
      searchFiles({
        query: debounced,
        category: category || undefined,
        starred: filter === "starred" || undefined,
        limit: 100,
      }),
    enabled: searching,
  });

  const breadcrumbs = useQuery({
    queryKey: ["folder-path", folderId],
    queryFn: () => getFolderPath(folderId!),
    enabled: Boolean(folderId),
  });

  /* Deep link to a single file (?file=<id>) opens its preview. */
  const deepLinkId = params.get("file");
  React.useEffect(() => {
    if (!deepLinkId) return;
    let active = true;
    (async () => {
      try {
        const file = await getFile(deepLinkId);
        if (active) setPreviewTarget(file);
      } catch {
        toast.error("That file could not be opened.");
      } finally {
        if (active) {
          const next = new URLSearchParams(params);
          next.delete("file");
          setParams(next, { replace: true });
        }
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId]);

  /* ?upload=1 opens the picker straight away (dashboard shortcut). */
  React.useEffect(() => {
    if (params.get("upload") !== "1") return;
    inputRef.current?.click();
    const next = new URLSearchParams(params);
    next.delete("upload");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const files = searching ? searchResults.data?.files ?? [] : listing.data?.files ?? [];
  const loading = searching ? searchResults.isLoading : listing.isLoading;
  const error = searching ? searchResults.error : listing.error;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["folder-tree"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["file-stats"] });
    queryClient.invalidateQueries({ queryKey: ["trash"] });
  };

  /* ---------------------------------------------------------- mutations */

  const makeFolder = useMutation({
    mutationFn: async () => createFolder(validateName(newFolderName), folderId),
    onSuccess: (folder) => {
      toast.success(`Folder “${folder.filename}” created`);
      setNewFolderOpen(false);
      setNewFolderName("");
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rename = useMutation({
    mutationFn: async () => renameFile(renameTarget!, validateName(renameValue)),
    onSuccess: () => {
      toast.success("Renamed");
      setRenameTarget(null);
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const remove = useMutation({
    mutationFn: async (items: FileItem[]) => {
      if (items.length === 1) await deleteFile(items[0]);
      else await bulkAction("delete", items.map((item) => item.id));
    },
    onSuccess: (_data, items) => {
      toast.success(items.length === 1 ? "Moved to trash" : `${items.length} items moved to trash`, {
        action: { label: "View trash", onClick: () => navigate("/trash") },
      });
      setDeleteTargets(null);
      setSelected(new Set());
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const star = useMutation({
    mutationFn: (file: FileItem) => toggleStar(file),
    onSuccess: () => refresh(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const relocate = useMutation({
    mutationFn: async (destination: string | null) => {
      const items = moveState?.items ?? [];
      if (moveState?.mode === "copy") {
        for (const item of items) await copyFile(item.id, destination);
      } else if (items.length === 1) {
        await moveFile(items[0].id, destination);
      } else {
        await bulkAction("move", items.map((item) => item.id), destination);
      }
    },
    onSuccess: () => {
      toast.success(moveState?.mode === "copy" ? "Copied" : "Moved");
      setMoveState(null);
      setSelected(new Set());
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const bulkStar = useMutation({
    mutationFn: (starred: boolean) => bulkAction(starred ? "star" : "unstar", [...selected]),
    onSuccess: () => {
      setSelected(new Set());
      refresh();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  /* ------------------------------------------------------------ uploads */

  const maxBytes = (config?.policy?.max_file_size_mb ?? 100) * 1024 * 1024;

  const startUpload = React.useCallback(
    async (fileList: FileList | File[]) => {
      const items = Array.from(fileList);
      if (items.length === 0) return;

      for (const file of items) {
        if (file.size > maxBytes) {
          toast.error(`${file.name} is larger than the ${formatBytes(maxBytes)} limit for your plan.`);
          continue;
        }
        const task: UploadTask = {
          id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          size: file.size,
          percent: 0,
          status: "uploading",
          controller: new AbortController(),
        };
        setUploads((current) => [...current, task]);

        try {
          await uploadFile(
            file,
            folderId,
            (progress) =>
              setUploads((current) =>
                current.map((item) => (item.id === task.id ? { ...item, percent: progress.percent } : item)),
              ),
            { signal: task.controller.signal },
          );
          setUploads((current) =>
            current.map((item) => (item.id === task.id ? { ...item, percent: 100, status: "done" } : item)),
          );
          refresh();
        } catch (err) {
          const cancelled = task.controller.signal.aborted;
          setUploads((current) =>
            current.map((item) =>
              item.id === task.id
                ? { ...item, status: cancelled ? "cancelled" : "error", error: cancelled ? undefined : errorMessage(err) }
                : item,
            ),
          );
          if (!cancelled) toast.error(`${file.name}: ${errorMessage(err)}`);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [folderId, maxBytes],
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files?.length) void startUpload(event.dataTransfer.files);
  };

  const activeUploads = uploads.filter((task) => task.status === "uploading");

  /* ------------------------------------------------------------ helpers */

  const toggleSelect = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedFiles = files.filter((file) => selected.has(file.id));

  const open = (file: FileItem) => {
    if (file.is_folder) navigate(`/files/${file.id}`);
    else setPreviewTarget(file);
  };

  const download = async (file: FileItem) => {
    try {
      await downloadFile(file);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(new Set());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ItemMenu: React.FC<{ file: FileItem }> = ({ file }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${file.filename}`} onClick={(e) => e.stopPropagation()}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
        {!file.is_folder ? (
          <>
            <DropdownMenuItem onClick={() => setPreviewTarget(file)}>
              <Search className="mr-2 h-4 w-4" /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => download(file)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onClick={() => setShareTarget(file)}>
          <Share2 className="mr-2 h-4 w-4" /> Share
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setDetailsTarget(file)}>
          <Info className="mr-2 h-4 w-4" /> Details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            setRenameTarget(file);
            setRenameValue(file.filename);
          }}
        >
          <Edit3 className="mr-2 h-4 w-4" /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setMoveState({ items: [file], mode: "move" })}>
          <Move className="mr-2 h-4 w-4" /> Move to…
        </DropdownMenuItem>
        {!file.is_folder ? (
          <DropdownMenuItem onClick={() => setMoveState({ items: [file], mode: "copy" })}>
            <Copy className="mr-2 h-4 w-4" /> Make a copy
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onClick={() => star.mutate(file)}>
          <Star className={cn("mr-2 h-4 w-4", file.is_starred && "fill-amber-400 text-amber-400")} />
          {file.is_starred ? "Remove star" : "Add star"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTargets([file])}>
          <Trash2 className="mr-2 h-4 w-4" /> Move to trash
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /* -------------------------------------------------------------- render */

  return (
    <div
      className="space-y-5"
      onDragOver={(event) => {
        event.preventDefault();
        if (!dragging) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <Seo title="Files" description="Browse, upload and organise everything in your CloudGather library." path="/files" noIndex />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void startUpload(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        // @ts-expect-error non-standard but widely supported directory picker
        webkitdirectory=""
        onChange={(event) => {
          if (event.target.files) void startUpload(event.target.files);
          event.target.value = "";
        }}
      />

      {/* Breadcrumbs + actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <Link to="/files" className="flex items-center gap-1 rounded px-1.5 py-1 hover:bg-muted">
            <Home className="h-4 w-4" /> My files
          </Link>
          {breadcrumbs.data?.map((crumb) => (
            <React.Fragment key={crumb.id}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Link to={`/files/${crumb.id}`} className="truncate rounded px-1.5 py-1 hover:bg-muted">
                {crumb.filename}
              </Link>
            </React.Fragment>
          ))}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setNewFolderOpen(true)}>
            <FolderPlus className="mr-2 h-4 w-4" /> New folder
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" /> Upload
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                <FileUp className="mr-2 h-4 w-4" /> Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => folderInputRef.current?.click()}>
                <FolderPlus className="mr-2 h-4 w-4" /> Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your files and connected drives…"
            className="pl-9"
            aria-label="Search files"
          />
          {search ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <Select value={filter || "all"} onValueChange={(value) => setFilter(value === "all" ? "" : (value as typeof filter))}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All items</SelectItem>
            <SelectItem value="starred">Starred</SelectItem>
            <SelectItem value="shared">Shared</SelectItem>
            <SelectItem value="folders">Folders</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category || "any"} onValueChange={(value) => setCategory(value === "any" ? "" : value)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="File type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any type</SelectItem>
            {CATEGORIES.map((item) => (
              <SelectItem key={item} value={item} className="capitalize">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={`${sortBy}:${direction}`}
          onValueChange={(value) => {
            const [nextSort, nextDirection] = value.split(":");
            setSortBy(nextSort as SortBy);
            setDirection(nextDirection as SortDirection);
          }}
        >
          <SelectTrigger className="w-full sm:w-40" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name:asc">Name A–Z</SelectItem>
            <SelectItem value="name:desc">Name Z–A</SelectItem>
            <SelectItem value="date:desc">Newest first</SelectItem>
            <SelectItem value="date:asc">Oldest first</SelectItem>
            <SelectItem value="size:desc">Largest first</SelectItem>
            <SelectItem value="size:asc">Smallest first</SelectItem>
            <SelectItem value="type:asc">Type</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex rounded-md border">
          <Button
            variant="ghost"
            size="icon"
            aria-label="List view"
            aria-pressed={view === "list"}
            className={cn("rounded-r-none", view === "list" && "bg-muted")}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={cn("rounded-l-none", view === "grid" && "bg-muted")}
            onClick={() => setView("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Selection bar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="ml-auto flex flex-wrap gap-1">
            <Button size="sm" variant="ghost" onClick={() => bulkStar.mutate(true)}>
              <Star className="mr-2 h-4 w-4" /> Star
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMoveState({ items: selectedFiles, mode: "move" })}>
              <Move className="mr-2 h-4 w-4" /> Move
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                for (const file of selectedFiles.filter((item) => !item.is_folder)) await download(file);
              }}
            >
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDeleteTargets(selectedFiles)}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Upload queue */}
      {uploads.length > 0 ? (
        <Card className="divide-y">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-sm font-medium">
              {activeUploads.length > 0 ? `Uploading ${activeUploads.length} file(s)…` : "Uploads"}
            </p>
            <Button variant="ghost" size="sm" onClick={() => setUploads((current) => current.filter((t) => t.status === "uploading"))}>
              Clear finished
            </Button>
          </div>
          <ul className="max-h-48 divide-y overflow-y-auto">
            {uploads.map((task) => (
              <li key={task.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <UploadCloud className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{task.name}</p>
                  {task.status === "uploading" ? (
                    <Progress value={task.percent} className="mt-1 h-1" />
                  ) : (
                    <p
                      className={cn(
                        "text-xs",
                        task.status === "done" ? "text-emerald-600" : task.status === "error" ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {task.status === "done" ? "Uploaded" : task.status === "cancelled" ? "Cancelled" : task.error}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(task.size)}</span>
                {task.status === "uploading" ? (
                  <Button variant="ghost" size="icon" aria-label="Cancel upload" onClick={() => task.controller.abort()}>
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {/* Content */}
      {error ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>We couldn&apos;t load your files</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{errorMessage(error)}</span>
            <Button
              variant="outline"
              className="w-fit"
              onClick={() => (searching ? searchResults.refetch() : listing.refetch())}
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : loading ? (
        <div className={cn(view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" : "space-y-2")}>
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className={view === "grid" ? "h-36 w-full rounded-xl" : "h-14 w-full"} />
          ))}
        </div>
      ) : files.length === 0 ? (
        searching ? (
          <EmptyState
            icon={SearchX}
            title={`No results for “${debounced}”`}
            description="Try a different term, or clear the filters to see everything."
            action={
              <Button variant="outline" onClick={() => { setSearch(""); setCategory(""); setFilter(""); }}>
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={UploadCloud}
            title={folderId ? "This folder is empty" : "Your library is empty"}
            description="Drag files anywhere on this page to upload, or connect a cloud drive to bring existing files in."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => inputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Upload files
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/providers">Connect a drive</Link>
                </Button>
              </div>
            }
          />
        )
      ) : view === "list" ? (
        <Card>
          <div className="flex items-center gap-3 border-b px-4 py-2 text-xs font-medium text-muted-foreground">
            <Checkbox
              checked={selected.size > 0 && selected.size === files.length}
              onCheckedChange={(checked) => setSelected(checked ? new Set(files.map((file) => file.id)) : new Set())}
              aria-label="Select all"
            />
            <span className="flex-1">Name</span>
            <span className="hidden w-24 text-right sm:block">Size</span>
            <span className="hidden w-32 text-right md:block">Modified</span>
            <span className="w-10" />
          </div>
          <ul className="divide-y">
            {files.map((file) => {
              const Icon = fileIconFor(file);
              return (
                <li
                  key={file.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50",
                    selected.has(file.id) && "bg-primary/5",
                  )}
                  onDoubleClick={() => open(file)}
                  onClick={(event) => {
                    if (event.detail > 1) return;
                    open(file);
                  }}
                >
                  <Checkbox
                    checked={selected.has(file.id)}
                    onCheckedChange={() => toggleSelect(file.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${file.filename}`}
                  />
                  <Icon className={cn("h-5 w-5 shrink-0", file.is_folder ? "text-primary" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {file.filename}
                      {file.is_starred ? <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" /> : null}
                      {file.is_shared ? <Share2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground sm:hidden">
                      {file.is_folder ? "Folder" : formatBytes(file.size)} · {formatRelativeTime(file.updated_at)}
                    </p>
                    {searching && file.path ? (
                      <p className="hidden truncate text-xs text-muted-foreground sm:block">{file.path}</p>
                    ) : null}
                  </div>
                  {file.storage_kind === "provider" && file.provider_name ? (
                    <Badge variant="outline" className="hidden shrink-0 lg:inline-flex">
                      {getProviderName(file.provider_name)}
                    </Badge>
                  ) : null}
                  <span className="hidden w-24 text-right text-sm text-muted-foreground sm:block">
                    {file.is_folder ? "—" : formatBytes(file.size)}
                  </span>
                  <span className="hidden w-32 text-right text-sm text-muted-foreground md:block">
                    {formatRelativeTime(file.updated_at)}
                  </span>
                  <ItemMenu file={file} />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.map((file) => {
            const Icon = fileIconFor(file);
            return (
              <Card
                key={file.id}
                className={cn(
                  "group relative cursor-pointer p-4 transition-colors hover:border-primary/40",
                  selected.has(file.id) && "border-primary bg-primary/5",
                )}
                onClick={() => open(file)}
              >
                <div className="absolute left-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 data-[checked=true]:opacity-100" data-checked={selected.has(file.id)}>
                  <Checkbox
                    checked={selected.has(file.id)}
                    onCheckedChange={() => toggleSelect(file.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${file.filename}`}
                  />
                </div>
                <div className="absolute right-2 top-2">
                  <ItemMenu file={file} />
                </div>
                <div className="flex flex-col items-center gap-3 pt-4 text-center">
                  <Icon className={cn("h-10 w-10", file.is_folder ? "text-primary" : "text-muted-foreground")} />
                  <div className="w-full min-w-0">
                    <p className="truncate text-sm font-medium">{file.filename}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {file.is_folder ? "Folder" : formatBytes(file.size)} · {formatRelativeTime(file.updated_at)}
                    </p>
                  </div>
                </div>
                {file.is_starred ? (
                  <Star className="absolute bottom-2 right-2 h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                ) : null}
              </Card>
            );
          })}
        </div>
      )}

      {searching && (searchResults.data?.total ?? 0) > files.length ? (
        <p className="text-center text-xs text-muted-foreground">
          Showing {files.length} of {searchResults.data?.total} matches — refine your search to narrow it down.
        </p>
      ) : null}

      {/* Drag overlay */}
      {dragging ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary px-10 py-8 text-center">
            <UploadCloud className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-lg font-semibold">Drop to upload</p>
            <p className="text-sm text-muted-foreground">Files land in the folder you&apos;re viewing.</p>
          </div>
        </div>
      ) : null}

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>Folders help you organise files across every connected drive.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              autoFocus
              value={newFolderName}
              onChange={(event) => setNewFolderName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && makeFolder.mutate()}
              placeholder="Project assets"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => makeFolder.mutate()} disabled={makeFolder.isPending || !newFolderName.trim()}>
              {makeFolder.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={renameTarget !== null} onOpenChange={(value) => !value && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-value">New name</Label>
            <Input
              id="rename-value"
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && rename.mutate()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => rename.mutate()} disabled={rename.isPending || !renameValue.trim()}>
              {rename.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTargets !== null}
        onOpenChange={(value) => !value && setDeleteTargets(null)}
        title={
          deleteTargets?.length === 1
            ? `Move “${deleteTargets[0].filename}” to trash?`
            : `Move ${deleteTargets?.length ?? 0} items to trash?`
        }
        description={`You can restore items from the trash for ${config?.policy?.trash_retention_days ?? 30} days.`}
        confirmLabel="Move to trash"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTargets && remove.mutate(deleteTargets)}
      />

      <MoveDialog
        open={moveState !== null}
        onOpenChange={(value) => !value && setMoveState(null)}
        excludeIds={moveState?.items.filter((item) => item.is_folder).map((item) => item.id) ?? []}
        title={moveState?.mode === "copy" ? "Copy to" : "Move to"}
        confirmLabel={moveState?.mode === "copy" ? "Copy here" : "Move here"}
        busy={relocate.isPending}
        onConfirm={(destination) => relocate.mutate(destination)}
      />

      <ShareDialog file={shareTarget} open={shareTarget !== null} onOpenChange={(value) => !value && setShareTarget(null)} />
      <FileDetailsSheet file={detailsTarget} open={detailsTarget !== null} onOpenChange={(value) => !value && setDetailsTarget(null)} />
      <PreviewDialog file={previewTarget} open={previewTarget !== null} onOpenChange={(value) => !value && setPreviewTarget(null)} />
    </div>
  );
};

export default FilesPage;
