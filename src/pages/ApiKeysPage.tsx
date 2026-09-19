import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { Seo } from "@/components/common/Seo";
import {
  Plus,
  Copy,
  Trash2,
  Loader2,
  ShieldCheck,
  Eye,
  EyeOff,
  ArrowRight,
  KeySquare,
} from "lucide-react";

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[] | null;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  status?: string;
}

const ALL_PERMISSIONS = ["read", "write", "share"] as const;

const permissionDescriptions: Record<string, string> = {
  read: "List and download files",
  write: "Create folders and upload files",
  share: "Create and revoke shares",
};

const ApiKeysPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPermissions, setNewPermissions] = useState<Set<string>>(new Set(["read"]));
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createdKeyVisible, setCreatedKeyVisible] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);

  const { data: keys, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async (): Promise<ApiKeyRow[]> => {
      const { data, error } = await supabase.functions.invoke("api-key-management", { method: "GET" });
      if (error) throw new Error(error.message || "Could not load API keys.");
      return (data?.keys ?? []) as ApiKeyRow[];
    },
    staleTime: 30 * 1000,
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("api-key-management", {
        method: "POST",
        body: { name: newName.trim(), permissions: Array.from(newPermissions) },
      });
      if (error) throw new Error(error.message || "Could not create the key.");
      return data as { apiKey: { key: string } };
    },
    onSuccess: (data) => {
      setCreatedKey(data.apiKey?.key ?? null);
      setCreateOpen(false);
      setNewName("");
      setNewPermissions(new Set(["read"]));
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeKey = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase.functions.invoke("api-key-management", {
        method: "DELETE",
        body: { id: keyId },
      });
      if (error) throw new Error(error.message || "Could not revoke the key.");
    },
    onSuccess: () => {
      toast.success("API key revoked");
      setRevokeTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const copyKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      toast.success("Key copied to clipboard");
    } catch {
      toast.error("Couldn't access the clipboard — select and copy the key manually.");
    }
  };

  // Clear the one-time secret when the dialog closes.
  useEffect(() => {
    if (!createdKey && !createOpen) return;
  }, [createdKey, createOpen]);

  return (
    <div className="space-y-6">
      <Seo title="API keys" description="Manage your CloudGather API keys." path="/api-keys" noIndex />
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">API keys</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Personal keys for the CloudGather REST API.{" "}
            <Link to="/developers" className="font-medium text-primary underline-offset-2 hover:underline">
              API docs <ArrowRight className="inline h-3 w-3" aria-hidden="true" />
            </Link>
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create key
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {isError && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="font-medium">Couldn&apos;t load your API keys</p>
            <p className="max-w-md text-sm text-muted-foreground">{(error as Error)?.message}</p>
            <Button variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (keys ?? []).length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <KeySquare className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
            <h2 className="font-semibold">No API keys yet</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Create a key to manage your files programmatically — list, upload, download and share via the REST API.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create your first key
            </Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && (keys ?? []).length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableCaption className="sr-only">Your API keys</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Key</TableHead>
                <TableHead className="hidden md:table-cell">Permissions</TableHead>
                <TableHead className="hidden lg:table-cell">Last used</TableHead>
                <TableHead className="hidden lg:table-cell">Created</TableHead>
                <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(keys ?? []).map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell className="hidden font-mono text-xs text-muted-foreground sm:table-cell">
                    {key.key_prefix}••••••••
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(key.permissions ?? ["read"]).map((p) => (
                        <Badge key={p} variant="secondary" className="text-[11px]">{p}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {key.last_used_at ? formatRelativeTime(key.last_used_at) : "Never"}
                  </TableCell>
                  <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                    {formatDate(key.created_at)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => setRevokeTarget(key)}
                      aria-label={`Revoke ${key.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) {
                toast.error("Give the key a name so you can recognize it later.");
                return;
              }
              if (newPermissions.size === 0) {
                toast.error("Select at least one permission.");
                return;
              }
              createKey.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Keys are shown once and stored as irreversible hashes. Treat them like passwords.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Backup script"
                  maxLength={100}
                />
              </div>
              <fieldset className="space-y-2.5">
                <legend className="text-sm font-medium">Permissions</legend>
                {ALL_PERMISSIONS.map((permission) => (
                  <label key={permission} className="flex cursor-pointer items-start gap-2.5 rounded-md border p-3 text-sm hover:bg-muted/50">
                    <Checkbox
                      checked={newPermissions.has(permission)}
                      onCheckedChange={(checked) =>
                        setNewPermissions((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(permission);
                          else next.delete(permission);
                          return next;
                        })
                      }
                    />
                    <span>
                      <span className="font-medium">{permission}</span>
                      <span className="block text-xs text-muted-foreground">{permissionDescriptions[permission]}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createKey.isPending}>
                {createKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time key display */}
      <Dialog open={Boolean(createdKey)} onOpenChange={(open) => !open && setCreatedKey(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-success" aria-hidden="true" /> Key created
            </DialogTitle>
            <DialogDescription>
              Copy your key now — for security it will never be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2.5 font-mono text-sm">
              {createdKeyVisible ? createdKey : "•".repeat(40)}
            </code>
            <Button variant="ghost" size="sm" className="h-9 w-9 shrink-0 p-0" onClick={() => setCreatedKeyVisible((v) => !v)} aria-label={createdKeyVisible ? "Hide key" : "Show key"}>
              {createdKeyVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => void copyKey()}>
              <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Copy
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>I&apos;ve saved my key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <Dialog open={Boolean(revokeTarget)} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke &quot;{revokeTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>
              Anything using this key will immediately lose access. This cannot be undone — create a new key to
              restore access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => revokeTarget && revokeKey.mutate(revokeTarget.id)} disabled={revokeKey.isPending}>
              {revokeKey.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Revoke key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApiKeysPage;
