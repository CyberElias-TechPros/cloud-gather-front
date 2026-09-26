import React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CopyButton } from "@/components/common/CopyButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createApiKey, deleteApiKey, listApiKeys, rotateApiKey } from "@/services/apiKeys";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { siteConfig } from "@/lib/site";
import { toast } from "sonner";
import type { ApiKeyRecord } from "@/types/api";

const SCOPE_HELP: Record<string, string> = {
  read: "List and download files, read metadata.",
  write: "Upload, rename, move and delete files.",
  share: "Create and revoke shares and public links.",
  admin: "Manage providers, webhooks and account settings.",
};

/** Personal access tokens for the public API. */
const ApiKeysPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [permissions, setPermissions] = React.useState<string[]>(["read"]);
  const [expiresAt, setExpiresAt] = React.useState("");
  const [freshSecret, setFreshSecret] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ApiKeyRecord | null>(null);
  const [rotateTarget, setRotateTarget] = React.useState<ApiKeyRecord | null>(null);

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: listApiKeys });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["api-keys"] });

  const create = useMutation({
    mutationFn: () =>
      createApiKey({
        name: name.trim(),
        permissions,
        description: description.trim() || undefined,
        expires_at: expiresAt || null,
      }),
    onSuccess: (data) => {
      setFreshSecret(data.key.key);
      setCreateOpen(false);
      setName("");
      setDescription("");
      setExpiresAt("");
      setPermissions(["read"]);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rotate = useMutation({
    mutationFn: (id: string) => rotateApiKey(id),
    onSuccess: (data) => {
      setFreshSecret(data.key.key);
      setRotateTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteApiKey(id),
    onSuccess: () => {
      toast.success("Key revoked");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const scopes = keys.data?.scopes ?? ["read", "write", "share", "admin"];
  const limit = keys.data?.limits?.max_keys ?? 0;
  const activeKeys = (keys.data?.keys ?? []).filter((key) => !key.revoked_at);

  const toggleScope = (scope: string) =>
    setPermissions((current) => (current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope]));

  return (
    <div className="space-y-6">
      <Seo title="API keys" description="Create and manage API keys for the CloudGather API." path="/api-keys" noIndex />
      <PageHeader
        title="API keys"
        icon={KeyRound}
        description="Authenticate scripts and integrations against the CloudGather API."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/developers">API docs</Link>
            </Button>
            <Button onClick={() => setCreateOpen(true)} disabled={limit > 0 && activeKeys.length >= limit}>
              <Plus className="mr-2 h-4 w-4" /> Create key
            </Button>
          </>
        }
      />

      {freshSecret ? (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Copy your key now — it won&apos;t be shown again</AlertTitle>
          <AlertDescription className="mt-2 space-y-3">
            <div className="flex items-center gap-2 rounded-md bg-muted p-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">{freshSecret}</code>
              <CopyButton value={freshSecret} successMessage="API key copied" />
            </div>
            <Button size="sm" variant="outline" onClick={() => setFreshSecret(null)}>
              I&apos;ve saved it
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Your keys</CardTitle>
          <CardDescription>
            {activeKeys.length}
            {limit ? ` of ${limit}` : ""} keys in use. Send them as{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">Authorization: Bearer cg_live_…</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {keys.isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div>
          ) : activeKeys.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={KeyRound}
              title="No API keys yet"
              description="Create a key to upload files, sync folders or build your own integration."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create your first key
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {activeKeys.map((key) => {
                const expired = key.expires_at ? new Date(key.expires_at).getTime() < Date.now() : false;
                return (
                  <li key={key.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {key.name}
                        {expired ? <Badge variant="destructive">Expired</Badge> : null}
                      </p>
                      {key.description ? <p className="text-sm text-muted-foreground">{key.description}</p> : null}
                      <code className="block font-mono text-xs text-muted-foreground">{key.key_prefix}••••••••</code>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {key.permissions.map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-[10px] uppercase">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created {formatRelativeTime(key.created_at)} ·{" "}
                        {key.last_used_at ? `last used ${formatRelativeTime(key.last_used_at)}` : "never used"} ·{" "}
                        {key.use_count} calls
                        {key.expires_at ? ` · expires ${formatDate(key.expires_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setRotateTarget(key)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Rotate
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteTarget(key)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Revoke
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick start</CardTitle>
          <CardDescription>Every endpoint is documented on the developers page.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed">
{`curl ${siteConfig.url.replace(/\/$/, "")}/api/files \\
  -H "Authorization: Bearer cg_live_your_key_here"`}
          </pre>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an API key</DialogTitle>
            <DialogDescription>Give the key a name and only the scopes it needs.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                required
                autoFocus
                placeholder="Backup script"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-description">Description (optional)</Label>
              <Input
                id="key-description"
                placeholder="Nightly sync from the office NAS"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Scopes</Label>
              <div className="space-y-2 rounded-md border p-3">
                {scopes.map((scope) => (
                  <label key={scope} className="flex items-start gap-2 text-sm">
                    <Checkbox checked={permissions.includes(scope)} onCheckedChange={() => toggleScope(scope)} />
                    <span>
                      <span className="font-medium uppercase">{scope}</span>
                      <span className="block text-xs text-muted-foreground">{SCOPE_HELP[scope] ?? ""}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-expiry">Expires (optional)</Label>
              <Input id="key-expiry" type="date" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending || !name.trim() || permissions.length === 0}>
                {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create key
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={rotateTarget !== null}
        onOpenChange={(open) => !open && setRotateTarget(null)}
        title={`Rotate “${rotateTarget?.name}”?`}
        description="The current secret stops working immediately and a new one is issued. Update your integrations right away."
        confirmLabel="Rotate key"
        loading={rotate.isPending}
        onConfirm={() => rotateTarget && rotate.mutate(rotateTarget.id)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Revoke “${deleteTarget?.name}”?`}
        description="Any integration using this key will immediately receive 401 responses."
        confirmLabel="Revoke key"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />

      {keys.isError ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Could not load your keys</AlertTitle>
          <AlertDescription>{errorMessage(keys.error)}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};

export default ApiKeysPage;
