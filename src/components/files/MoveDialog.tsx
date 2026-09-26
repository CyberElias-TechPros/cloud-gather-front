import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Folder, FolderOpen, Home, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFolderTree } from "@/services/files";
import { cn } from "@/lib/utils";

interface FolderNode {
  id: string;
  filename: string;
  path: string;
  parent_folder_id: string | null;
}

interface MoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ids that cannot be chosen (the items being moved and their subtrees). */
  excludeIds?: string[];
  title?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (destinationId: string | null) => void;
}

/** Folder picker used by move and copy actions. */
export const MoveDialog: React.FC<MoveDialogProps> = ({
  open,
  onOpenChange,
  excludeIds = [],
  title = "Move to",
  confirmLabel = "Move here",
  busy,
  onConfirm,
}) => {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const tree = useQuery({ queryKey: ["folder-tree"], queryFn: getFolderTree, enabled: open });

  const blocked = React.useMemo(() => {
    const excluded = new Set(excludeIds);
    const folders = tree.data ?? [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const folder of folders) {
        if (folder.parent_folder_id && excluded.has(folder.parent_folder_id) && !excluded.has(folder.id)) {
          excluded.add(folder.id);
          changed = true;
        }
      }
    }
    return excluded;
  }, [excludeIds, tree.data]);

  const childrenOf = (parentId: string | null): FolderNode[] =>
    (tree.data ?? []).filter((folder) => (folder.parent_folder_id ?? null) === parentId);

  const renderLevel = (parentId: string | null, depth: number): React.ReactNode =>
    childrenOf(parentId).map((folder) => {
      const disabled = blocked.has(folder.id);
      const hasChildren = childrenOf(folder.id).length > 0;
      const isOpen = expanded.has(folder.id);
      return (
        <div key={folder.id}>
          <div
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
              disabled ? "opacity-40" : "cursor-pointer hover:bg-muted",
              selected === folder.id && "bg-primary/10 text-primary",
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
            onClick={() => !disabled && setSelected(folder.id)}
          >
            <button
              type="button"
              className={cn("flex h-4 w-4 items-center justify-center", !hasChildren && "invisible")}
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                });
              }}
              aria-label={isOpen ? "Collapse" : "Expand"}
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
            </button>
            {isOpen ? <FolderOpen className="h-4 w-4 text-muted-foreground" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
            <span className="truncate">{folder.filename}</span>
          </div>
          {isOpen ? renderLevel(folder.id, depth + 1) : null}
        </div>
      );
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Pick a destination folder.</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto rounded-md border p-2">
          <div
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
              selected === null && "bg-primary/10 text-primary",
            )}
            onClick={() => setSelected(null)}
          >
            <Home className="h-4 w-4" /> My files (root)
          </div>
          {tree.isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-6 w-full" />)}
            </div>
          ) : (
            renderLevel(null, 0)
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(selected)} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MoveDialog;
