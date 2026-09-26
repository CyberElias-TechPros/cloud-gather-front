import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  Webhook as WebhookIcon,
} from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createWebhook,
  deleteWebhook,
  listDeliveries,
  listWebhooks,
  revealSecret,
  testWebhook,
  updateWebhook,
} from "@/services/webhooks";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { WebhookEndpoint } from "@/types/api";

/** Outbound webhook endpoints with event filters, secrets and delivery logs. */
const WebhooksPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [url, setUrl] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [events, setEvents] = React.useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = React.useState<WebhookEndpoint | null>(null);
  const [deliveriesFor, setDeliveriesFor] = React.useState<WebhookEndpoint | null>(null);
  const [secrets, setSecrets] = React.useState<Record<string, string>>({});

  const webhooks = useQuery({ queryKey: ["webhooks"], queryFn: listWebhooks });
  const deliveries = useQuery({
    queryKey: ["webhooks", "deliveries", deliveriesFor?.id],
    queryFn: () => listDeliveries(deliveriesFor!.id),
    enabled: Boolean(deliveriesFor),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["webhooks"] });

  const create = useMutation({
    mutationFn: () => createWebhook({ url: url.trim(), events, description: description.trim() || undefined }),
    onSuccess: (data) => {
      toast.success("Endpoint created");
      setSecrets((current) => ({ ...current, [data.endpoint.id]: data.secret }));
      setCreateOpen(false);
      setUrl("");
      setDescription("");
      setEvents([]);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateWebhook(id, { enabled }),
    onSuccess: invalidate,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteWebhook(id),
    onSuccess: () => {
      toast.success("Endpoint deleted");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const test = useMutation({
    mutationFn: (id: string) => testWebhook(id),
    onSuccess: (data) =>
      data.ok
        ? toast.success(`Endpoint responded with ${data.status}`)
        : toast.error(`Delivery failed (${data.status || "no response"})`),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reveal = useMutation({
    mutationFn: (id: string) => revealSecret(id),
    onSuccess: (data, id) => setSecrets((current) => ({ ...current, [id]: data.secret })),
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = webhooks.data;
  const available = data?.available ?? true;
  const limit = data?.limits?.max_endpoints ?? 0;
  const endpoints = data?.endpoints ?? [];
  const catalogue = data?.events ?? [];

  const toggleEvent = (event: string) =>
    setEvents((current) => (current.includes(event) ? current.filter((item) => item !== event) : [...current, event]));

  return (
    <div className="space-y-6">
      <Seo title="Webhooks" description="Receive CloudGather events in your own systems." path="/webhooks" noIndex />
      <PageHeader
        title="Webhooks"
        icon={WebhookIcon}
        description="Send real-time events to your backend when files change."
        actions={
          <Button onClick={() => setCreateOpen(true)} disabled={!available || endpoints.length >= limit}>
            <Plus className="mr-2 h-4 w-4" /> Add endpoint
          </Button>
        }
      />

      {!available ? (
        <Alert>
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Webhooks are a paid feature</AlertTitle>
          <AlertDescription>
            Upgrade to Pro or above to stream events. <Link className="underline" to="/billing">See plans</Link>.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            {endpoints.length} of {limit} used on your plan. We sign every request with an HMAC-SHA256 header.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {webhooks.isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}
            </div>
          ) : endpoints.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={WebhookIcon}
              title="No endpoints yet"
              description="Point CloudGather at an HTTPS URL and we'll POST a signed JSON payload whenever the events you pick occur."
              action={
                <Button onClick={() => setCreateOpen(true)} disabled={!available}>
                  <Plus className="mr-2 h-4 w-4" /> Add your first endpoint
                </Button>
              }
            />
          ) : (
            <ul className="divide-y">
              {endpoints.map((endpoint) => (
                <li key={endpoint.id} className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        <span className="truncate">{endpoint.url}</span>
                        {endpoint.disabled_at ? <Badge variant="outline">Disabled</Badge> : <Badge variant="secondary">Active</Badge>}
                        {endpoint.failure_count > 0 ? (
                          <Badge variant="destructive">{endpoint.failure_count} failures</Badge>
                        ) : null}
                      </p>
                      {endpoint.description ? (
                        <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        Created {formatRelativeTime(endpoint.created_at)}
                        {endpoint.last_success_at ? ` · last success ${formatRelativeTime(endpoint.last_success_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={!endpoint.disabled_at}
                        aria-label="Enable endpoint"
                        onCheckedChange={(checked) => toggleEnabled.mutate({ id: endpoint.id, enabled: checked })}
                      />
                      <Button variant="ghost" size="sm" onClick={() => test.mutate(endpoint.id)} disabled={test.isPending}>
                        {test.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Test
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeliveriesFor(endpoint)}>
                        <Activity className="mr-2 h-4 w-4" /> Deliveries
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Delete endpoint" onClick={() => setDeleteTarget(endpoint)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {endpoint.events.map((event) => (
                      <Badge key={event} variant="outline" className="font-mono text-[10px]">
                        {event}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                    <span className="text-xs font-medium text-muted-foreground">Signing secret</span>
                    <code className="flex-1 truncate font-mono text-xs">
                      {secrets[endpoint.id] ?? "whsec_••••••••••••••••••••••"}
                    </code>
                    {secrets[endpoint.id] ? (
                      <>
                        <CopyButton value={secrets[endpoint.id]} successMessage="Secret copied" />
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Hide secret"
                          onClick={() =>
                            setSecrets((current) => {
                              const next = { ...current };
                              delete next[endpoint.id];
                              return next;
                            })
                          }
                        >
                          <EyeOff className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="icon" aria-label="Reveal secret" onClick={() => reveal.mutate(endpoint.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Add a webhook endpoint</DialogTitle>
            <DialogDescription>We&apos;ll POST a signed JSON payload to this URL for the selected events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://api.example.com/hooks/cloudgather"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-description">Description (optional)</Label>
              <Input
                id="webhook-description"
                placeholder="Production ingest"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Events</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                  onClick={() => setEvents(events.length === catalogue.length ? [] : [...catalogue])}
                >
                  {events.length === catalogue.length ? "Clear all" : "Select all"}
                </button>
              </div>
              <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
                {catalogue.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={events.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                    <span className="font-mono text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !/^https?:\/\//.test(url.trim()) || events.length === 0}
            >
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deliveries dialog */}
      <Dialog open={deliveriesFor !== null} onOpenChange={(open) => !open && setDeliveriesFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Recent deliveries</DialogTitle>
            <DialogDescription className="truncate">{deliveriesFor?.url}</DialogDescription>
          </DialogHeader>
          {deliveries.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (deliveries.data?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No deliveries yet. Send a test event to try it out.</p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.data?.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-mono text-xs">{delivery.event_type}</TableCell>
                      <TableCell>
                        <Badge variant={delivery.status === "delivered" ? "secondary" : "destructive"}>
                          {delivery.status}
                          {delivery.response_status ? ` · ${delivery.response_status}` : ""}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{delivery.attempts}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(delivery.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this endpoint?"
        description={`We'll stop sending events to ${deleteTarget?.url}. Existing delivery history is removed too.`}
        confirmLabel="Delete endpoint"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </div>
  );
};

export default WebhooksPage;
