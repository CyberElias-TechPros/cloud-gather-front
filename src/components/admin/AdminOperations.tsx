import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, HardDrive, Loader2, Mail, Play, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { flushOutbox, getStorageReport, listOutbox, listSubscribers, runMaintenanceTask } from "@/services/admin";
import { formatBytes, formatDateTime, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

const TASKS = [
  { id: "all", label: "Run everything" },
  { id: "email", label: "Flush email outbox" },
  { id: "trash", label: "Purge expired trash" },
  { id: "sessions", label: "Prune expired sessions" },
  { id: "tokens", label: "Refresh provider tokens" },
  { id: "digest", label: "Send weekly digests" },
  { id: "accounts", label: "Purge deleted accounts" },
];

/** Background jobs, the email outbox, storage reporting and newsletter list. */
const AdminOperations: React.FC = () => {
  const queryClient = useQueryClient();
  const [outboxStatus, setOutboxStatus] = React.useState("pending");
  const [task, setTask] = React.useState("all");

  const outbox = useQuery({ queryKey: ["admin", "outbox", outboxStatus], queryFn: () => listOutbox(outboxStatus) });
  const storage = useQuery({ queryKey: ["admin", "storage"], queryFn: getStorageReport });
  const subscribers = useQuery({ queryKey: ["admin", "subscribers"], queryFn: listSubscribers });

  const flush = useMutation({
    mutationFn: flushOutbox,
    onSuccess: (data) => {
      toast.success(`${data.sent} sent · ${data.failed} failed`);
      queryClient.invalidateQueries({ queryKey: ["admin", "outbox"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const run = useMutation({
    mutationFn: () => runMaintenanceTask(task),
    onSuccess: (data) => {
      toast.success(`Task “${data.task}” finished`, { description: JSON.stringify(data.result).slice(0, 180) });
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const exportSubscribers = () => {
    const rows = subscribers.data?.items ?? [];
    const csv = ["email,source,subscribed_at", ...rows.map((row) => `${row.email},${row.source ?? ""},${row.created_at}`)].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cloudgather-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scheduled jobs</CardTitle>
          <CardDescription>
            Cron runs every 5 minutes (email + tokens), daily at 03:00 (trash, sessions, accounts) and Mondays at 08:00
            (digests). Trigger a run manually if you cannot wait.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Select value={task} onValueChange={setTask}>
            <SelectTrigger className="w-64" aria-label="Maintenance task">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASKS.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Run now
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Email outbox</CardTitle>
            <CardDescription>{outbox.data?.total ?? 0} messages with status “{outboxStatus}”.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={outboxStatus} onValueChange={setOutboxStatus}>
              <SelectTrigger className="w-36" aria-label="Outbox status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["pending", "sent", "failed"].map((value) => (
                  <SelectItem key={value} value={value} className="capitalize">
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => flush.mutate()} disabled={flush.isPending}>
              {flush.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Flush
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {outbox.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
            </div>
          ) : (outbox.data?.items?.length ?? 0) === 0 ? (
            <EmptyState className="border-0" icon={Mail} title="Outbox is clear" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="hidden md:table-cell">Attempts</TableHead>
                    <TableHead className="hidden lg:table-cell">Queued</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outbox.data?.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-sm">{row.to_email}</TableCell>
                      <TableCell className="text-sm">
                        {row.subject}
                        {row.last_error ? <p className="text-xs text-destructive">{row.last_error}</p> : null}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{row.attempts}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {formatRelativeTime(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={row.status === "failed" ? "destructive" : "secondary"} className="capitalize">
                          {row.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" /> Storage by user
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {storage.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-8 w-full" />)
            ) : (storage.data?.top_users?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No managed storage in use yet.</p>
            ) : (
              storage.data?.top_users.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{row.email}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatBytes(row.bytes)} · {row.files} files · <span className="capitalize">{row.plan}</span>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Storage by category &amp; providers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              {(storage.data?.by_category ?? []).map((row) => (
                <div key={row.category} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{row.category}</span>
                  <span className="text-muted-foreground">
                    {row.files} files · {formatBytes(row.bytes)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 border-t pt-3">
              {(storage.data?.providers ?? []).map((row) => (
                <div key={row.provider_name} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{row.provider_name.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">
                    {row.connections} connected
                    {row.errors > 0 ? <span className="text-destructive"> · {row.errors} errored</span> : null}
                  </span>
                </div>
              ))}
              {(storage.data?.providers ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No provider connections yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Newsletter subscribers
            </CardTitle>
            <CardDescription>{subscribers.data?.total ?? 0} confirmed addresses.</CardDescription>
          </div>
          <Button variant="outline" onClick={exportSubscribers} disabled={(subscribers.data?.items?.length ?? 0) === 0}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {subscribers.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (subscribers.data?.items?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has subscribed yet.</p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {subscribers.data?.items.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3">
                  <span className="truncate">{row.email}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {row.source ?? "website"} · {formatDateTime(row.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOperations;
