import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Seo } from "@/components/common/Seo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Search,
  MoreVertical,
  Unplug,
  Loader2,
  Cloud,
  ArrowDownUp,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  listProviders,
  disconnectProvider,
  updateProviderOrder,
  type StorageProvider,
} from "@/services/files";
import { PROVIDERS, getProviderMeta, getProviderName } from "@/lib/providers";
import { formatBytes } from "@/lib/format";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const ProvidersPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<StorageProvider[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [connecting, setConnecting] = useState<string | null>(null);
  const [credentialsTarget, setCredentialsTarget] = useState<string | null>(null);
  const [credentialValues, setCredentialValues] = useState<Record<string, string>>({});
  const [connectingBusy, setConnectingBusy] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<StorageProvider | null>(null);
  const [disconnectBusy, setDisconnectBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProviders(await listProviders());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Surface the result of an OAuth callback redirect (?connect=success|error).
  useEffect(() => {
    const connect = searchParams.get("connect");
    if (!connect) return;
    if (connect === "success") toast.success("Provider connected");
    else toast.error("Provider connection didn't complete. Please try again.");
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectedByProvider = useMemo(() => {
    const map = new Map<string, StorageProvider>();
    providers.filter((p) => p.status === "connected").forEach((p) => map.set(p.provider_name, p));
    return map;
  }, [providers]);

  const catalogue = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return PROVIDERS.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleConnectOAuth = async (providerId: string) => {
    // Real OAuth requires provider apps + edge function configuration. Until the
    // operator configures credentials, surface an honest, actionable state.
    setConnectingBusy(true);
    try {
      const data = await api<{ url: string }>(`/providers/${providerId}/oauth?redirect=${encodeURIComponent(`${window.location.origin}/providers`)}`);
      if (!data?.url) {
        toast.error(
          `${getProviderName(providerId)} sign-in isn't configured yet on this deployment. An operator needs to add the ${getProviderName(providerId)} OAuth credentials (see the deployment guide).`,
          { duration: 7000 }
        );
        return;
      }
      window.location.href = data.url as string;
    } catch {
      toast.error(
        `${getProviderName(providerId)} sign-in isn't configured yet on this deployment. See the deployment guide for setup steps.`,
        { duration: 7000 }
      );
    } finally {
      setConnectingBusy(false);
      setConnecting(null);
    }
  };

  const handleConnectCredentials = async () => {
    if (!credentialsTarget) return;
    const meta = getProviderMeta(credentialsTarget);
    if (!meta?.credentialFields) return;
    for (const field of meta.credentialFields) {
      if (field.required && !credentialValues[field.key]?.trim()) {
        toast.error(`${field.label} is required.`);
        return;
      }
    }
    setConnectingBusy(true);
    try {
      // Credentials-based providers are stored through the sync-auth edge
      // function, which validates and normalizes them server-side.
      await api("/providers/connect", {
        method: "POST",
        body: JSON.stringify({ provider: credentialsTarget, credentials: credentialValues }),
      });
      toast.success(`${meta.name} connected`);
      setCredentialsTarget(null);
      setCredentialValues({});
      await load();
    } catch (err) {
      toast.error((err as Error).message || `Could not connect ${meta?.name}.`);
    } finally {
      setConnectingBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget || disconnectBusy) return;
    setDisconnectBusy(true);
    try {
      await disconnectProvider(disconnectTarget.id);
      toast.success(`${getProviderName(disconnectTarget.provider_name)} disconnected`);
      setDisconnectTarget(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDisconnectBusy(false);
    }
  };

  const moveProvider = async (provider: StorageProvider, direction: -1 | 1) => {
    const ids = providers.map((p) => p.id);
    const index = ids.indexOf(provider.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setProviders((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    try {
      await updateProviderOrder(ids);
    } catch {
      toast.error("Could not save the new order.");
      await load();
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Seo title="Providers" description="CloudGather providers" path="/providers" noIndex />
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Providers</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Connect the storage accounts you already use. Tokens are stored server-side and can be revoked anytime.
          </p>
        </div>
        <div className="relative lg:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search providers…"
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search providers"
          />
        </div>
      </div>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-7 w-7 text-destructive" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={() => void load()}>Try again</Button>
          </CardContent>
        </Card>
      )}

      {!error && (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {catalogue.map((provider) => {
            const connected = connectedByProvider.get(provider.id);
            return (
              <li key={provider.id}>
                <Card className={cn("card-hover h-full", connected && "border-primary/40")}>
                  <CardContent className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted">
                        <provider.icon className={cn("h-6 w-6", provider.color)} aria-hidden="true" />
                      </span>
                      {connected ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" aria-hidden="true" /> Connected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Not connected</Badge>
                      )}
                    </div>

                    <div>
                      <h2 className="font-semibold">{provider.name}</h2>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>

                    {connected && (
                      <p className="text-xs text-muted-foreground">
                        {connected.provider_user_email && <>Account: {connected.provider_user_email}<br /></>}
                        {connected.total_space
                          ? `${formatBytes(connected.used_space ?? 0)} of ${formatBytes(connected.total_space)} used`
                          : "Quota unknown"}
                      </p>
                    )}

                    <div className="mt-auto flex gap-2 pt-1">
                      {connected ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setDisconnectTarget(connected)}
                          >
                            <Unplug className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> Disconnect
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`More options for ${provider.name}`}>
                                <MoreVertical className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => void moveProvider(connected, -1)}>
                                <ArrowDownUp className="mr-2 h-4 w-4" aria-hidden="true" /> Move up in pool order
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void moveProvider(connected, 1)}>
                                <ArrowDownUp className="mr-2 h-4 w-4" aria-hidden="true" /> Move down in pool order
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() =>
                            provider.kind === "oauth"
                              ? (setConnecting(provider.id), void handleConnectOAuth(provider.id))
                              : setCredentialsTarget(provider.id)
                          }
                          disabled={connectingBusy}
                        >
                          {connectingBusy && connecting === provider.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Cloud className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          Connect
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* Credentials dialog for key-based providers */}
      <Dialog open={Boolean(credentialsTarget)} onOpenChange={(open) => !open && setCredentialsTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect {getProviderName(credentialsTarget ?? undefined)}</DialogTitle>
            <DialogDescription>
              Credentials are sent to the CloudGather backend over HTTPS and stored server-side, scoped to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(getProviderMeta(credentialsTarget ?? "")?.credentialFields ?? []).map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`cred-${field.key}`}>{field.label}</Label>
                <Input
                  id={`cred-${field.key}`}
                  type={field.type}
                  autoComplete="off"
                  value={credentialValues[field.key] ?? ""}
                  onChange={(e) => setCredentialValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
                {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
              </div>
            ))}
            {getProviderMeta(credentialsTarget ?? "")?.docsUrl && (
              <a
                href={getProviderMeta(credentialsTarget ?? "")?.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Where do I find these? <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCredentialsTarget(null)}>Cancel</Button>
            <Button onClick={() => void handleConnectCredentials()} disabled={connectingBusy}>
              {connectingBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <Dialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect {getProviderName(disconnectTarget?.provider_name)}?</DialogTitle>
            <DialogDescription>
              Your stored tokens for this provider will be deleted immediately. Files already uploaded to CloudGather
              storage stay where they are; files that live in this provider will no longer be reachable from CloudGather.
              You can reconnect at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => void handleDisconnect()} disabled={disconnectBusy}>
              {disconnectBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProvidersPage;
