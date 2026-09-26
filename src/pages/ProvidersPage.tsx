import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Cloud,
  CloudOff,
  ExternalLink,
  FolderDown,
  FolderOpen,
  Loader2,
  Pencil,
  Plug,
  RefreshCw,
  TriangleAlert,
  Unplug,
} from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import {
  browseProvider,
  connectWithCredentials,
  disconnect,
  getCatalogue,
  importFromProvider,
  listConnections,
  reorderConnections,
  startOAuth,
  syncProvider,
  updateConnection,
} from "@/services/providers";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { getProviderIcon, getProviderName } from "@/lib/providers";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ConnectedProvider, ProviderCatalogueEntry } from "@/types/api";

/** Connect, sync and import from external storage providers. */
const ProvidersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [credentialTarget, setCredentialTarget] = React.useState<ProviderCatalogueEntry | null>(null);
  const [credentials, setCredentials] = React.useState<Record<string, string>>({});
  const [displayName, setDisplayName] = React.useState("");
  const [disconnectTarget, setDisconnectTarget] = React.useState<ConnectedProvider | null>(null);
  const [renameTarget, setRenameTarget] = React.useState<ConnectedProvider | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [browseTarget, setBrowseTarget] = React.useState<ConnectedProvider | null>(null);
  const [browsePath, setBrowsePath] = React.useState<{ id: string | null; name: string }[]>([]);
  const [connecting, setConnecting] = React.useState<string | null>(null);

  const catalogue = useQuery({ queryKey: ["provider-catalogue"], queryFn: getCatalogue });
  const connections = useQuery({ queryKey: ["providers"], queryFn: listConnections });

  const currentFolder = browsePath.length ? browsePath[browsePath.length - 1].id : null;
  const browse = useQuery({
    queryKey: ["provider-browse", browseTarget?.id, currentFolder],
    queryFn: () => browseProvider(browseTarget!.id, currentFolder),
    enabled: Boolean(browseTarget),
  });

  /* OAuth round-trip feedback (?connected=google-drive or ?error=…) */
  React.useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) {
      toast.success(`${getProviderName(connected)} connected`);
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    }
    if (error) toast.error(decodeURIComponent(error));
    if (connected || error) {
      const next = new URLSearchParams(params);
      next.delete("connected");
      next.delete("error");
      setParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["providers"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
    queryClient.invalidateQueries({ queryKey: ["file-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const beginOAuth = async (provider: ProviderCatalogueEntry) => {
    setConnecting(provider.id);
    try {
      const { url } = await startOAuth(provider.id);
      window.location.assign(url);
    } catch (error) {
      toast.error(errorMessage(error));
      setConnecting(null);
    }
  };

  const connect = useMutation({
    mutationFn: () => connectWithCredentials(credentialTarget!.id, credentials, displayName.trim() || undefined),
    onSuccess: (data) => {
      toast.success(`${getProviderName(data.provider.provider_name)} connected`);
      setCredentialTarget(null);
      setCredentials({});
      setDisplayName("");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const sync = useMutation({
    mutationFn: (id: string) => syncProvider(id),
    onSuccess: (data) => {
      toast.success(`Indexed ${data.indexed} item${data.indexed === 1 ? "" : "s"}`);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const rename = useMutation({
    mutationFn: () => updateConnection(renameTarget!.id, { display_name: renameValue.trim() }),
    onSuccess: () => {
      toast.success("Name updated");
      setRenameTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => disconnect(id),
    onSuccess: () => {
      toast.success("Drive disconnected");
      setDisconnectTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderConnections(ids),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const importFile = useMutation({
    mutationFn: ({ entry }: { entry: { id: string; name: string } }) =>
      importFromProvider(browseTarget!.id, { file_id: entry.id, name: entry.name }),
    onSuccess: (data) => {
      toast.success(`${data.file.filename} imported into your library`);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const move = (index: number, delta: number) => {
    const list = [...(connections.data ?? [])];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    reorder.mutate(list.map((item) => item.id));
  };

  const connected = connections.data ?? [];
  const connectedIds = new Set(connected.map((item) => item.provider_name));
  const available = catalogue.data?.providers ?? [];
  const roadmap = catalogue.data?.roadmap ?? [];

  return (
    <div className="space-y-6">
      <Seo title="Connected drives" description="Connect Google Drive, Dropbox, OneDrive, S3 and more." path="/providers" noIndex />
      <PageHeader
        title="Connected drives"
        icon={Cloud}
        description="Bring every cloud you use into one searchable library."
        actions={
          <Button variant="outline" asChild>
            <Link to="/files">Go to files</Link>
          </Button>
        }
      />

      {/* Connected */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your drives</h2>
        {connections.isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : connected.length === 0 ? (
          <EmptyState
            icon={CloudOff}
            title="No drives connected yet"
            description="Connect your first cloud account below — we only ever request the access we need."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {connected.map((provider, index) => {
              const Icon = getProviderIcon(provider.provider_name);
              const used = provider.used_space ?? 0;
              const total = provider.total_space ?? 0;
              return (
                <Card key={provider.id} className={cn(provider.status === "error" && "border-destructive/50")}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start gap-3">
                      <Icon className="h-8 w-8 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {provider.display_name || getProviderName(provider.provider_name)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {provider.provider_user_email || getProviderName(provider.provider_name)}
                        </p>
                      </div>
                      <Badge variant={provider.status === "error" ? "destructive" : "secondary"}>{provider.status}</Badge>
                    </div>

                    {total > 0 ? (
                      <div className="space-y-1">
                        <Progress value={Math.min((used / total) * 100, 100)} className="h-1.5" />
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(used)} of {formatBytes(total)} used
                        </p>
                      </div>
                    ) : null}

                    <p className="text-xs text-muted-foreground">
                      {provider.file_count} files indexed
                      {provider.last_sync_at ? ` · synced ${formatRelativeTime(provider.last_sync_at)}` : " · never synced"}
                    </p>

                    {provider.last_error ? (
                      <Alert variant="destructive" className="py-2">
                        <TriangleAlert className="h-4 w-4" />
                        <AlertDescription className="text-xs">{provider.last_error}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => sync.mutate(provider.id)} disabled={sync.isPending}>
                        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", sync.isPending && "animate-spin")} /> Sync
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setBrowseTarget(provider);
                          setBrowsePath([]);
                        }}
                      >
                        <FolderOpen className="mr-2 h-3.5 w-3.5" /> Browse
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Rename"
                        onClick={() => {
                          setRenameTarget(provider);
                          setRenameValue(provider.display_name || getProviderName(provider.provider_name));
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Move up" onClick={() => move(index, -1)} disabled={index === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label="Move down"
                        onClick={() => move(index, 1)}
                        disabled={index === connected.length - 1}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive"
                        onClick={() => setDisconnectTarget(provider)}
                      >
                        <Unplug className="mr-2 h-3.5 w-3.5" /> Disconnect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Catalogue */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Add a drive</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {catalogue.isLoading
            ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-40 w-full rounded-xl" />)
            : available.map((provider) => {
                const Icon = getProviderIcon(provider.id);
                const already = connectedIds.has(provider.id);
                return (
                  <Card key={provider.id} className="flex flex-col">
                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <Icon className="h-8 w-8 shrink-0" />
                        <div className="min-w-0">
                          <CardTitle className="text-base">{provider.name}</CardTitle>
                          <CardDescription className="line-clamp-2">{provider.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="mt-auto space-y-2">
                      {!provider.configured ? (
                        <>
                          <Badge variant="outline" className="gap-1">
                            <TriangleAlert className="h-3 w-3" /> Needs configuration
                          </Badge>
                          {provider.setupHint ? (
                            <p className="text-xs text-muted-foreground">{provider.setupHint}</p>
                          ) : null}
                          <Button size="sm" variant="outline" className="w-full" disabled>
                            Unavailable
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="w-full"
                          variant={already ? "outline" : "default"}
                          disabled={connecting === provider.id}
                          onClick={() => {
                            if (provider.kind === "oauth") void beginOAuth(provider);
                            else {
                              setCredentialTarget(provider);
                              setCredentials({});
                              setDisplayName("");
                            }
                          }}
                        >
                          {connecting === provider.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : already ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Plug className="mr-2 h-4 w-4" />
                          )}
                          {already ? "Add another" : "Connect"}
                        </Button>
                      )}
                      {provider.docsUrl ? (
                        <a
                          href={provider.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Provider docs <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
        </div>
      </section>

      {roadmap.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Coming soon</h2>
          <div className="flex flex-wrap gap-2">
            {roadmap.map((provider) => (
              <Badge key={provider.id} variant="outline" className="px-3 py-1.5 text-xs font-normal">
                {provider.name} — {provider.note}
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      {/* Credentials dialog */}
      <Dialog open={credentialTarget !== null} onOpenChange={(open) => !open && setCredentialTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {credentialTarget?.name}</DialogTitle>
            <DialogDescription>
              Credentials are encrypted before they are stored and are never shown again.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              connect.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="provider-label">Display name (optional)</Label>
              <Input
                id="provider-label"
                placeholder={credentialTarget?.name}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            {credentialTarget?.credentialFields?.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`field-${field.key}`}>
                  {field.label}
                  {field.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                <Input
                  id={`field-${field.key}`}
                  type={field.type === "password" ? "password" : "text"}
                  required={field.required}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  value={credentials[field.key] ?? ""}
                  onChange={(event) =>
                    setCredentials((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                />
                {field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}
              </div>
            ))}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCredentialTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={connect.isPending}>
                {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Connect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename connection</DialogTitle>
          </DialogHeader>
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={() => rename.mutate()} disabled={rename.isPending || !renameValue.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browse dialog */}
      <Dialog open={browseTarget !== null} onOpenChange={(open) => !open && setBrowseTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Browse {browseTarget?.display_name || getProviderName(browseTarget?.provider_name ?? "")}
            </DialogTitle>
            <DialogDescription>Import files into your CloudGather library.</DialogDescription>
          </DialogHeader>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            <button type="button" className="rounded px-1.5 py-1 hover:bg-muted" onClick={() => setBrowsePath([])}>
              Root
            </button>
            {browsePath.map((crumb, index) => (
              <React.Fragment key={`${crumb.id}-${index}`}>
                <span className="text-muted-foreground">/</span>
                <button
                  type="button"
                  className="rounded px-1.5 py-1 hover:bg-muted"
                  onClick={() => setBrowsePath((current) => current.slice(0, index + 1))}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </nav>

          <div className="max-h-80 overflow-y-auto rounded-md border">
            {browse.isLoading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}
              </div>
            ) : browse.isError ? (
              <p className="p-4 text-sm text-destructive">{errorMessage(browse.error)}</p>
            ) : (browse.data?.entries.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">This folder is empty.</p>
            ) : (
              <ul className="divide-y">
                {browse.data?.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    {entry.isFolder ? (
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:underline"
                        onClick={() => setBrowsePath((current) => [...current, { id: entry.id, name: entry.name }])}
                      >
                        <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate">{entry.name}</span>
                      </button>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(entry.size ?? 0)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => importFile.mutate({ entry: { id: entry.id, name: entry.name } })}
                          disabled={importFile.isPending}
                        >
                          <FolderDown className="mr-2 h-3.5 w-3.5" /> Import
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={disconnectTarget !== null}
        onOpenChange={(open) => !open && setDisconnectTarget(null)}
        title={`Disconnect ${disconnectTarget?.display_name || getProviderName(disconnectTarget?.provider_name ?? "")}?`}
        description="We'll remove the stored credentials and stop indexing this drive. Files already imported into CloudGather stay put; files that live only on the provider disappear from your library."
        confirmLabel="Disconnect"
        destructive
        loading={remove.isPending}
        onConfirm={() => disconnectTarget && remove.mutate(disconnectTarget.id)}
      />
    </div>
  );
};

export default ProvidersPage;
