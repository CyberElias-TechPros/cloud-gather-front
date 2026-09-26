import React from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/common/EmptyState";
import { listAuditLog } from "@/services/admin";
import { formatDateTime } from "@/lib/format";

const SEVERITY_VARIANT: Record<string, "secondary" | "default" | "destructive" | "outline"> = {
  info: "secondary",
  notice: "outline",
  warning: "default",
  critical: "destructive",
  error: "destructive",
};

/** Searchable, paginated view of the immutable activity/audit trail. */
const AdminAuditLog: React.FC = () => {
  const [action, setAction] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [severity, setSeverity] = React.useState("all");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(action.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [action]);

  const log = useQuery({
    queryKey: ["admin", "audit", debounced, severity, page],
    queryFn: () =>
      listAuditLog({
        action: debounced || undefined,
        severity: severity === "all" ? undefined : severity,
        page,
      }),
  });

  const items = log.data?.items ?? [];
  const pages = log.data?.pages ?? 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Audit log</CardTitle>
        <CardDescription>{log.data?.total ?? 0} events. Entries are append-only and retained per your data policy.</CardDescription>
        <div className="flex flex-col gap-2 pt-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter by action, e.g. user.login"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            />
          </div>
          <Select value={severity} onValueChange={(value) => { setSeverity(value); setPage(1); }}>
            <SelectTrigger className="sm:w-40" aria-label="Severity filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {["info", "notice", "warning", "critical"].map((level) => (
                <SelectItem key={level} value={level} className="capitalize">
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {log.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-10 w-full" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState className="border-0" icon={ScrollText} title="No matching events" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="hidden md:table-cell">Actor</TableHead>
                  <TableHead className="hidden lg:table-cell">Resource</TableHead>
                  <TableHead className="hidden lg:table-cell">IP</TableHead>
                  <TableHead>Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{event.action}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{event.actor_email ?? "system"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {event.resource_type ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {event.ip_address ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={SEVERITY_VARIANT[event.severity] ?? "secondary"} className="capitalize">
                        {event.severity}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {pages > 1 ? (
          <div className="flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
              Previous
            </Button>
            <span className="text-muted-foreground">
              Page {page} of {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((current) => current + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default AdminAuditLog;
