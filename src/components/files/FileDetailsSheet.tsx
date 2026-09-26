import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Loader2, RotateCcw, Save, Tag } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { listVersions, restoreVersion, updateFile } from "@/services/files";
import { formatBytes, formatDateTime, formatRelativeTime } from "@/lib/format";
import { getProviderName } from "@/lib/providers";
import { fileIconFor } from "@/lib/fileIcons";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";

interface FileDetailsSheetProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Side panel with metadata, tags, description and version history. */
export const FileDetailsSheet: React.FC<FileDetailsSheetProps> = ({ file, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const [description, setDescription] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);

  React.useEffect(() => {
    setDescription(file?.description ?? "");
    setTags(file?.tags ?? []);
    setTagInput("");
  }, [file]);

  const versions = useQuery({
    queryKey: ["file-versions", file?.id],
    queryFn: () => listVersions(file!.id),
    enabled: open && Boolean(file) && !file?.is_folder,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["file-versions", file?.id] });
    queryClient.invalidateQueries({ queryKey: ["recents"] });
  };

  const save = useMutation({
    mutationFn: () => updateFile(file!.id, { description: description.trim(), tags }),
    onSuccess: () => {
      toast.success("Details saved");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const restore = useMutation({
    mutationFn: (versionId: string) => restoreVersion(file!.id, versionId),
    onSuccess: () => {
      toast.success("Version restored");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const addTag = () => {
    const value = tagInput.trim().replace(/,$/, "");
    if (!value || tags.includes(value)) return;
    setTags((current) => [...current, value]);
    setTagInput("");
  };

  if (!file) return null;
  const Icon = fileIconFor(file);
  const dirty = description !== (file.description ?? "") || tags.join(",") !== (file.tags ?? []).join(",");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 pr-6 text-left">
            <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
            <span className="truncate">{file.filename}</span>
          </SheetTitle>
          <SheetDescription className="text-left">
            {file.is_folder ? "Folder" : `${formatBytes(file.size)} · ${file.mime_type || "unknown type"}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <dl className="space-y-2 text-sm">
            {[
              { label: "Location", value: file.path || "/" },
              { label: "Created", value: formatDateTime(file.created_at) },
              { label: "Modified", value: formatDateTime(file.updated_at) },
              { label: "Last opened", value: file.last_accessed_at ? formatRelativeTime(file.last_accessed_at) : "—" },
              { label: "Storage", value: file.storage_kind === "provider" ? getProviderName(file.provider_name) : "CloudGather" },
              { label: "Downloads", value: String(file.download_count ?? 0) },
              { label: "Version", value: `v${file.version ?? 1}` },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="max-w-[60%] truncate text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="file-description">Description</Label>
            <Textarea
              id="file-description"
              rows={3}
              placeholder="What is this file for?"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />

            <Label htmlFor="file-tags">Tags</Label>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove ${tag}`}
                    className="ml-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                id="file-tags"
                placeholder="Add a tag and press Enter"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addTag();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addTag}>
                <Tag className="h-4 w-4" />
              </Button>
            </div>

            <Button className="w-full" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save details
            </Button>
          </div>

          {!file.is_folder ? (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" /> Version history
                </h3>
                {versions.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : (versions.data?.versions?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Only the current version exists. Re-upload a file with the same name to create a new version.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {versions.data?.versions.map((version) => (
                      <li key={version.id} className="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">v{version.version}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatBytes(version.size)} · {formatRelativeTime(version.created_at)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => restore.mutate(version.id)}
                          disabled={restore.isPending}
                        >
                          <RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FileDetailsSheet;
