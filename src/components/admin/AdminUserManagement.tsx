import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Search, UserPlus, UserMinus, Shield, ShieldAlert, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

interface ProfileRow {
  id: string;
  display_name: string | null;
  role: string | null;
  created_at: string;
}

interface AdminRow {
  id: string;
  email: string;
  created_at: string;
}

const emailOk = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const AdminUserManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<AdminRow | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const usersQuery = useQuery({
    queryKey: ["admin-users", searchTerm],
    queryFn: () => api<{ users: ProfileRow[]; admins: AdminRow[] }>(`/admin/users?search=${encodeURIComponent(searchTerm)}`),
  });
  const profilesQuery = { ...usersQuery, data: usersQuery.data?.users };
  const adminUsersQuery = { ...usersQuery, data: usersQuery.data?.admins };
  const addAdminMutation = useMutation({
    mutationFn: (email: string) => api("/admin/users/role", { method: "POST", body: JSON.stringify({ email: email.trim().toLowerCase(), role: "admin" }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Admin added"); setNewAdminEmail(""); setIsAddingAdmin(false); },
    onError: (error: Error) => toast.error(error.message),
  });
  const removeAdminMutation = useMutation({
    mutationFn: (email: string) => api("/admin/users/role", { method: "POST", body: JSON.stringify({ email, role: "user" }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast.success("Admin removed"); setRemoveTarget(null); },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleAddAdmin = () => {
    if (!emailOk(newAdminEmail.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    addAdminMutation.mutate(newAdminEmail);
  };

  const profiles = profilesQuery.data ?? [];
  const adminUsers = adminUsersQuery.data ?? [];

  if (profilesQuery.isLoading || adminUsersQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {(profilesQuery.isError || adminUsersQuery.isError) && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Couldn&apos;t load user data</AlertTitle>
          <AlertDescription>
            {(profilesQuery.error as Error)?.message ?? (adminUsersQuery.error as Error)?.message} — make sure the
            admin RLS policies from the consolidated migration are applied.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search users by name…"
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search users"
          />
        </div>
        <Button onClick={() => setIsAddingAdmin(true)}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" /> Add admin
        </Button>
      </div>

      {/* Admins */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admins</CardTitle>
          <CardDescription>People with console access. The list is maintained in the admin_users table.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {adminUsers.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No admins configured.</p>
          ) : (
            adminUsers.map((admin) => {
              const isSelf = admin.email.toLowerCase() === user?.email?.toLowerCase();
              return (
                <div key={admin.id} className="flex items-center justify-between gap-3 rounded-lg border p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Shield className="h-4.5 w-4.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {admin.email}
                        {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">Admin since {formatDate(admin.created_at)}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSelf}
                    title={isSelf ? "You can't remove your own admin access" : "Remove admin"}
                    onClick={() => setRemoveTarget(admin)}
                  >
                    <UserMinus className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">Remove {admin.email}</span>
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users ({profiles.length})</CardTitle>
          <CardDescription>Newest 200 registered users.</CardDescription>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {searchTerm ? "No users match your search." : "No users registered yet."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="sr-only">Registered users</caption>
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-2.5 font-medium">Name</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Role</th>
                    <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((profile) => (
                    <tr key={profile.id} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-medium">{profile.display_name || "—"}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={profile.role === "admin" ? "default" : "secondary"}>{profile.role ?? "user"}</Badge>
                      </td>
                      <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{formatDate(profile.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add admin dialog */}
      <Dialog open={isAddingAdmin} onOpenChange={setIsAddingAdmin}>
        <DialogContent className="sm:max-w-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddAdmin();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add admin</DialogTitle>
              <DialogDescription>
                The user must already have a {`CloudGather`} account with this email address.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="user@example.com"
                autoFocus
              />
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsAddingAdmin(false)}>Cancel</Button>
              <Button type="submit" disabled={addAdminMutation.isPending}>
                {addAdminMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Add admin
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remove admin confirmation */}
      <Dialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove admin access?</DialogTitle>
            <DialogDescription>
              {removeTarget?.email} will immediately lose access to the admin console and admin-only data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => removeTarget && removeAdminMutation.mutate(removeTarget.email)}
              disabled={removeAdminMutation.isPending}
            >
              {removeAdminMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Remove admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;
