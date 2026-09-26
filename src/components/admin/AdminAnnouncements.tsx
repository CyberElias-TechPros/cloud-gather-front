import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  broadcastAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "@/services/admin";
import { formatDateTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { Announcement } from "@/types/api";

const LEVEL_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  info: "secondary",
  success: "outline",
  warning: "default",
  critical: "destructive",
};

const emptyDraft = (): Partial<Announcement> => ({
  title: "",
  body: "",
  level: "info",
  audience: "all",
  starts_at: null,
  ends_at: null,
  published: true,
});

/** Site-wide announcement banners plus one-click notification broadcast. */
const AdminAnnouncements: React.FC = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<Partial<Announcement> | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Announcement | null>(null);

  const announcements = useQuery({ queryKey: ["admin", "announcements"], queryFn: listAnnouncements });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "announcements"] });
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  const save = useMutation({
    mutationFn: () => (draft?.id ? updateAnnouncement(draft.id, draft) : createAnnouncement(draft ?? {})),
    onSuccess: () => {
      toast.success(draft?.id ? "Announcement updated" : "Announcement created");
      setDraft(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const broadcast = useMutation({
    mutationFn: (id: string) => broadcastAnnouncement(id),
    onSuccess: (data) => toast.success(`Delivered to ${data.delivered} user(s)`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      toast.success("Announcement deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = announcements.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Announcements</CardTitle>
          <CardDescription>Banners shown in-app. Broadcasting also creates a notification for every user.</CardDescription>
        </div>
        <Button onClick={() => setDraft(emptyDraft())}>
          <Plus className="mr-2 h-4 w-4" /> New announcement
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {announcements.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 w-full" />)
        ) : items.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={Megaphone}
            title="No announcements"
            description="Publish maintenance windows, new features or incident updates."
          />
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant={LEVEL_VARIANT[item.level] ?? "secondary"} className="capitalize">
                    {item.level}
                  </Badge>
                  <Badge variant="outline" className="capitalize">{item.audience}</Badge>
                  {item.published ? null : <Badge variant="outline">Draft</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.starts_at ? `From ${formatDateTime(item.starts_at)}` : "Active now"}
                  {item.ends_at ? ` · until ${formatDateTime(item.ends_at)}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="Broadcast" onClick={() => broadcast.mutate(item.id)}>
                  <Send className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setDraft({ ...item })}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete"
                  className="text-destructive"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>Leave the dates empty to show the banner immediately and indefinitely.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                value={draft?.title ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-body">Body</Label>
              <Textarea
                id="ann-body"
                rows={3}
                value={draft?.body ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ann-level">Level</Label>
                <Select
                  value={draft?.level ?? "info"}
                  onValueChange={(value) => setDraft((current) => ({ ...current, level: value as Announcement["level"] }))}
                >
                  <SelectTrigger id="ann-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["info", "success", "warning", "critical"].map((level) => (
                      <SelectItem key={level} value={level} className="capitalize">
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-audience">Audience</Label>
                <Select
                  value={draft?.audience ?? "all"}
                  onValueChange={(value) => setDraft((current) => ({ ...current, audience: value }))}
                >
                  <SelectTrigger id="ann-audience">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="authenticated">Signed-in users</SelectItem>
                    <SelectItem value="admin">Admins only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-start">Starts</Label>
                <Input
                  id="ann-start"
                  type="datetime-local"
                  value={draft?.starts_at ? String(draft.starts_at).slice(0, 16) : ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      starts_at: event.target.value ? new Date(event.target.value).toISOString() : null,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ann-end">Ends</Label>
                <Input
                  id="ann-end"
                  type="datetime-local"
                  value={draft?.ends_at ? String(draft.ends_at).slice(0, 16) : ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      ends_at: event.target.value ? new Date(event.target.value).toISOString() : null,
                    }))
                  }
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={Boolean(draft?.published ?? true)}
                onCheckedChange={(checked) => setDraft((current) => ({ ...current, published: checked }))}
              />
              Published
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={!draft?.title || !draft?.body || save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete announcement?"
        description="The banner disappears for all users immediately."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </Card>
  );
};

export default AdminAnnouncements;
