import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Download, FolderOpen, Info, Share2, Star } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShareDialog } from "@/components/files/ShareDialog";
import { FileDetailsSheet } from "@/components/files/FileDetailsSheet";
import { PreviewDialog } from "@/components/files/PreviewDialog";
import { downloadFile, listActivity, listRecents, queryFiles } from "@/services/files";
import { formatBytes, formatDateTime, formatRelativeTime } from "@/lib/format";
import { fileIconFor } from "@/lib/fileIcons";
import { getProviderName } from "@/lib/providers";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";

const SEVERITY_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "outline",
  error: "destructive",
  critical: "destructive",
};

/** Recently opened files, starred items and the account activity log. */
const RecentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [shareTarget, setShareTarget] = React.useState<FileItem | null>(null);
  const [detailsTarget, setDetailsTarget] = React.useState<FileItem | null>(null);
  const [previewTarget, setPreviewTarget] = React.useState<FileItem | null>(null);

  const recents = useQuery({ queryKey: ["recents"], queryFn: () => listRecents(30) });
  const starred = useQuery({
    queryKey: ["files", "starred-all"],
    queryFn: () => queryFiles({ all: true, filter: "starred", sortBy: "date", direction: "desc", limit: 50 }),
  });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => listActivity(50) });

  const download = async (file: FileItem) => {
    try {
      await downloadFile(file);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const FileList: React.FC<{ files: FileItem[]; loading: boolean; empty: React.ReactNode }> = ({ files, loading, empty }) => {
    if (loading) {
      return (
        <div className="space-y-2 p-4">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
        </div>
      );
    }
    if (files.length === 0) return <>{empty}</>;
    return (
      <ul className="divide-y">
        {files.map((file) => {
          const Icon = fileIconFor(file);
          return (
            <li key={file.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40">
              <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => (file.is_folder ? navigate(`/files/${file.id}`) : setPreviewTarget(file))}
              >
                <p className="flex items-center gap-2 truncate text-sm font-medium">
                  {file.filename}
                  {file.is_starred ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {file.is_folder ? "Folder" : formatBytes(file.size)} ·{" "}
                  {formatRelativeTime(file.last_accessed_at || file.updated_at)}
                  {file.path ? ` · ${file.path}` : ""}
                </p>
              </button>
              {file.provider_name ? (
                <Badge variant="outline" className="hidden shrink-0 md:inline-flex">
                  {getProviderName(file.provider_name)}
                </Badge>
              ) : null}
              <div className="flex shrink-0 gap-1">
                {!file.is_folder ? (
                  <Button variant="ghost" size="icon" aria-label="Download" onClick={() => download(file)}>
                    <Download className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="icon" aria-label="Share" onClick={() => setShareTarget(file)}>
                  <Share2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Details" onClick={() => setDetailsTarget(file)}>
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="space-y-6">
      <Seo title="Recent" description="Files you opened recently and your account activity." path="/recents" noIndex />
      <PageHeader
        title="Recent"
        icon={Clock}
        description="Pick up where you left off."
        actions={
          <Button variant="outline" asChild>
            <Link to="/files">All files</Link>
          </Button>
        }
      />

      <Tabs defaultValue="recent">
        <TabsList>
          <TabsTrigger value="recent">Recently opened</TabsTrigger>
          <TabsTrigger value="starred">Starred</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="recent" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <FileList
                files={recents.data ?? []}
                loading={recents.isLoading}
                empty={
                  <EmptyState
                    className="border-0"
                    icon={FolderOpen}
                    title="Nothing opened yet"
                    description="Files you view or download appear here for quick access."
                    action={
                      <Button asChild>
                        <Link to="/files">Browse files</Link>
                      </Button>
                    }
                  />
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="starred" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <FileList
                files={starred.data?.files ?? []}
                loading={starred.isLoading}
                empty={
                  <EmptyState
                    className="border-0"
                    icon={Star}
                    title="No starred items"
                    description="Star files and folders to keep them one click away."
                  />
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Account activity</CardTitle>
              <CardDescription>Every meaningful action on your account, newest first.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {activity.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                </div>
              ) : (activity.data?.length ?? 0) === 0 ? (
                <EmptyState className="border-0" icon={Activity} title="No activity recorded yet" />
              ) : (
                <ul className="divide-y">
                  {activity.data?.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 px-4 py-3">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">{event.action.replace(/[._]/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.resource_type ? `${event.resource_type} · ` : ""}
                          {formatDateTime(event.created_at)}
                        </p>
                      </div>
                      {event.severity && event.severity !== "info" ? (
                        <Badge variant={SEVERITY_VARIANT[event.severity] ?? "outline"} className="capitalize">
                          {event.severity}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ShareDialog file={shareTarget} open={shareTarget !== null} onOpenChange={(open) => !open && setShareTarget(null)} />
      <FileDetailsSheet file={detailsTarget} open={detailsTarget !== null} onOpenChange={(open) => !open && setDetailsTarget(null)} />
      <PreviewDialog file={previewTarget} open={previewTarget !== null} onOpenChange={(open) => !open && setPreviewTarget(null)} />
    </div>
  );
};

export default RecentsPage;
