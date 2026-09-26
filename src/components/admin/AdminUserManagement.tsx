import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut, Search, ShieldCheck, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import {
  deleteUser,
  listUsers,
  revokeUserSessions,
  sendPasswordReset,
  updateUser,
  type AdminUser,
} from "@/services/admin";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  suspended: "destructive",
  pending_deletion: "outline",
};

/** Search, inspect and administer user accounts. */
const AdminUserManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const { user: me } = useAuth();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [role, setRole] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [editing, setEditing] = React.useState<AdminUser | null>(null);
  const [form, setForm] = React.useState<{ role: string; status: string; plan: string; quotaGb: string }>({
    role: "user",
    status: "active",
    plan: "free",
    quotaGb: "",
  });
  const [deleteTarget, setDeleteTarget] = React.useState<AdminUser | null>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const users = useQuery({
    queryKey: ["admin", "users", debounced, role, status, page],
    queryFn: () =>
      listUsers({
        search: debounced || undefined,
        role: role === "all" ? undefined : role,
        status: status === "all" ? undefined : status,
        page,
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const save = useMutation({
    mutationFn: () =>
      updateUser(editing!.id, {
        role: form.role,
        status: form.status,
        plan: form.plan,
        storage_quota_bytes: form.quotaGb ? Math.round(Number(form.quotaGb) * 1024 ** 3) : null,
      }),
    onSuccess: () => {
      toast.success("User updated");
      setEditing(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => sendPasswordReset(id),
    onSuccess: () => toast.success("Password reset email queued"),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const revokeSessions = useMutation({
    mutationFn: (id: string) => revokeUserSessions(id),
    onSuccess: (data) => toast.success(`${data.revoked} session(s) revoked`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      toast.success("Account scheduled for deletion");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rows = users.data?.users ?? [];
  const pages = users.data?.pages ?? 1;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users.data?.total ?? 0} accounts · {users.data?.admins?.length ?? 0} administrators
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by email or name…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={role} onValueChange={(value) => { setRole(value); setPage(1); }}>
              <SelectTrigger className="sm:w-36" aria-label="Role filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="user">Users</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="sm:w-40" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="pending_deletion">Pending deletion</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {users.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState className="border-0" icon={UserCog} title="No users match those filters" />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="hidden md:table-cell">Plan</TableHead>
                    <TableHead className="hidden lg:table-cell">Storage</TableHead>
                    <TableHead className="hidden lg:table-cell">Last seen</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="flex items-center gap-2 font-medium">
                          {row.display_name || row.email.split("@")[0]}
                          {row.role === "admin" ? (
                            <Badge variant="outline" className="gap-1">
                              <ShieldCheck className="h-3 w-3" /> Admin
                            </Badge>
                          ) : null}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.email}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell capitalize">{row.plan}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatBytes(row.storage_bytes)} · {row.file_count} files
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {row.last_login_at ? formatRelativeTime(row.last_login_at) : "never"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="capitalize">
                          {row.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit user"
                            onClick={() => {
                              setEditing(row);
                              setForm({
                                role: row.role,
                                status: row.status,
                                plan: row.plan,
                                quotaGb: row.storage_quota_bytes ? String(row.storage_quota_bytes / 1024 ** 3) : "",
                              });
                            }}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Send password reset"
                            onClick={() => resetPassword.mutate(row.id)}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Revoke sessions"
                            onClick={() => revokeSessions.mutate(row.id)}
                          >
                            <LogOut className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete user"
                            className="text-destructive"
                            disabled={row.id === me?.id}
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

      {/* Edit dialog */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.email}</DialogTitle>
            <DialogDescription>Changes take effect immediately and are written to the audit log.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select value={form.role} onValueChange={(value) => setForm((current) => ({ ...current, role: value }))}>
                <SelectTrigger id="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={form.status} onValueChange={(value) => setForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-plan">Plan</Label>
              <Select value={form.plan} onValueChange={(value) => setForm((current) => ({ ...current, plan: value }))}>
                <SelectTrigger id="edit-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["free", "pro", "team", "enterprise"].map((plan) => (
                    <SelectItem key={plan} value={plan} className="capitalize">
                      {plan}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-quota">Storage override (GB)</Label>
              <Input
                id="edit-quota"
                type="number"
                min={0}
                placeholder="Plan default"
                value={form.quotaGb}
                onChange={(event) => setForm((current) => ({ ...current, quotaGb: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.email}?`}
        description="The account is scheduled for deletion and all files are removed after the grace period."
        confirmLabel="Schedule deletion"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
};

export default AdminUserManagement;
