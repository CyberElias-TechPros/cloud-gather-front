import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Loader2, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { bulkAction, emptyTrash, listTrash, restoreFromTrash } from "@/services/files";
import { useAppConfig } from "@/hooks/useAppConfig";
import { formatBytes, formatDate, formatRelativeTime } from "@/lib/format";
import { fileIconFor } from "@/lib/fileIcons";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

/** Deleted items, restorable until the retention window closes. */
const TrashPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: config } = useAppConfig();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [confirm, setConfirm] = React.useState<null | "empty" | "purge">(null);

  const trash = useQuery({ queryKey: ["trash"], queryFn: listTrash });
  const items = trash.data?.files ?? [];

  const refresh = () => {
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["trash"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["file-stats"] });
  };

  const restore = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 1) await restoreFromTrash(ids[0]);
      else await bulkAction("restore", ids);
    },
    onSuccess: (_result, ids) => {
      toast.success(ids.length === 1 ? "Item restored" : `${ids.length} items restored`);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const purge = useMutation({
    mutationFn: async () => {
      if (confirm === "empty") return emptyTrash();
      return bulkAction("purge", [...selected]);
    },
    onSuccess: () => {
      toast.success("Deleted permanently");
      setConfirm(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const retention = config?.policy?.trash_retention_days ?? 30;
  const totalBytes = trash.data?.bytes ?? items.reduce((sum, item) => sum + (item.size || 0), 0);

  return (
    <div className="space-y-6">
      <Seo title="Trash" description="Restore or permanently remove deleted files." path="/trash" noIndex />
      <PageHeader
        title="Trash"
        icon={Trash2}
        description={`Items are permanently deleted ${retention} days after they are moved here.`}
        actions={
          <>
            {selected.size > 0 ? (
              <>
                <Button variant="outline" onClick={() => restore.mutate([...selected])} disabled={restore.isPending}>
                  {restore.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                  Restore ({selected.size})
                </Button>
                <Button variant="destructive" onClick={() => setConfirm("purge")}>
                  <Trash2 className="mr-2 h-4 w-4" /> Delete forever
                </Button>
              </>
            ) : null}
            <Button variant="outline" disabled={items.length === 0} onClick={() => setConfirm("empty")}>
              Empty trash
            </Button>
          </>
        }
      />

      {trash.isError ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Could not load the trash</AlertTitle>
          <AlertDescription>{errorMessage(trash.error)}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {trash.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={Trash2}
              title="Trash is empty"
              description="Deleted files land here first so you can change your mind."
              action={
                <Button asChild variant="outline">
                  <Link to="/files">Back to files</Link>
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between border-b px-4 py-2 text-sm text-muted-foreground">
                <span>
                  {items.length} item{items.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
                </span>
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() =>
                    setSelected((current) => (current.size === items.length ? new Set() : new Set(items.map((item) => item.id))))
                  }
                >
                  {selected.size === items.length ? "Clear selection" : "Select all"}
                </button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Size</TableHead>
                    <TableHead className="hidden md:table-cell">Deleted</TableHead>
                    <TableHead className="hidden lg:table-cell">Purges</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const Icon = fileIconFor(item);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggle(item.id)}
                            aria-label={`Select ${item.filename}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate">{item.filename}</span>
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {item.is_folder ? "—" : formatBytes(item.size)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {formatRelativeTime(item.deleted_at)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {item.purge_at ? formatDate(item.purge_at) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => restore.mutate([item.id])} disabled={restore.isPending}>
                            <RotateCcw className="mr-2 h-4 w-4" /> Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === "empty" ? "Empty the trash?" : `Permanently delete ${selected.size} item(s)?`}
        description="This removes the files from storage immediately. It cannot be undone."
        confirmLabel="Delete forever"
        destructive
        loading={purge.isPending}
        onConfirm={() => purge.mutate()}
      />
    </div>
  );
};

export default TrashPage;
