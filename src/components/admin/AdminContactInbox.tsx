import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Loader2, Mail, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { deleteContactMessage, listContactMessages, updateContactMessage } from "@/services/admin";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ContactMessage } from "@/types/api";

const STATUS_VARIANT: Record<ContactMessage["status"], "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  open: "secondary",
  resolved: "outline",
  spam: "destructive",
};

/** Support inbox: triage, reply to and archive contact-form enquiries. */
const AdminContactInbox: React.FC = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [reply, setReply] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<ContactMessage | null>(null);

  const messages = useQuery({
    queryKey: ["admin", "contact", status],
    queryFn: () => listContactMessages(status === "all" ? undefined : status),
  });

  const items = messages.data?.items ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  React.useEffect(() => {
    setReply(selected?.reply ?? "");
  }, [selected?.id, selected?.reply]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "contact"] });

  const update = useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { status?: string; reply?: string } }) =>
      updateContactMessage(id, changes),
    onSuccess: () => {
      toast.success("Enquiry updated");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteContactMessage(id),
    onSuccess: () => {
      toast.success("Enquiry deleted");
      setDeleteTarget(null);
      setSelectedId(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="h-fit">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Inbox</CardTitle>
          <CardDescription>{messages.data?.total ?? 0} enquiries</CardDescription>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="mt-2" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="spam">Spam</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="max-h-[540px] overflow-y-auto p-0">
          {messages.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <EmptyState className="border-0" icon={Inbox} title="Inbox zero" description="No enquiries match this filter." />
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      selected?.id === item.id && "bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.subject}</span>
                      <Badge variant={STATUS_VARIANT[item.status]} className="shrink-0 text-[10px] capitalize">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{selected.subject}</CardTitle>
                <CardDescription>
                  {selected.name} &lt;{selected.email}&gt; · {formatDateTime(selected.created_at)}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{selected.topic}</Badge>
                <Select
                  value={selected.status}
                  onValueChange={(value) => update.mutate({ id: selected.id, changes: { status: value } })}
                >
                  <SelectTrigger className="h-8 w-32" aria-label="Change status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="Delete enquiry"
                  onClick={() => setDeleteTarget(selected)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm">{selected.message}</div>

            {selected.replied_at ? (
              <p className="text-xs text-muted-foreground">Replied {formatRelativeTime(selected.replied_at)}</p>
            ) : null}

            <div className="space-y-2">
              <label htmlFor="reply" className="text-sm font-medium">
                Reply
              </label>
              <Textarea
                id="reply"
                rows={6}
                placeholder="Write a response — it is emailed to the sender and stored on the ticket."
                value={reply}
                onChange={(event) => setReply(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!reply.trim() || update.isPending}
                  onClick={() => update.mutate({ id: selected.id, changes: { reply: reply.trim(), status: "resolved" } })}
                >
                  {update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  Send reply &amp; resolve
                </Button>
                <Button variant="outline" asChild>
                  <a href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.subject)}`}>
                    <Mail className="mr-2 h-4 w-4" /> Open in mail client
                  </a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="flex items-center justify-center p-10">
          <EmptyState className="border-0" icon={Mail} title="Select an enquiry" description="Pick a message to read and reply." />
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this enquiry?"
        description="The message and any reply are permanently removed."
        confirmLabel="Delete"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
};

export default AdminContactInbox;
