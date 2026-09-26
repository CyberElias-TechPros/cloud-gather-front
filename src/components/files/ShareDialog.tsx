import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Eye, Link2, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyButton } from "@/components/common/CopyButton";
import { listShares, shareFile } from "@/services/files";
import {
  createLink,
  listFileLinks,
  listLinkVisits,
  revokeLink,
  revokeShare,
  type CreateLinkInput,
} from "@/services/shares";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { useAppConfig } from "@/hooks/useAppConfig";
import { toast } from "sonner";
import type { FileItem } from "@/types/file";
import type { PublicLink } from "@/types/api";

interface ShareDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const linkUrl = (link: PublicLink) => link.url || `${window.location.origin}/l/${link.token ?? link.token_prefix}`;

/** People-and-links sharing surface for a single file or folder. */
export const ShareDialog: React.FC<ShareDialogProps> = ({ file, open, onOpenChange }) => {
  const queryClient = useQueryClient();
  const { data: config } = useAppConfig();
  const fileId = file?.id ?? "";

  const [email, setEmail] = React.useState("");
  const [permission, setPermission] = React.useState<"view" | "edit">("view");
  const [message, setMessage] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");

  const [linkForm, setLinkForm] = React.useState<CreateLinkInput>({ allow_download: true });
  const [linkPassword, setLinkPassword] = React.useState("");
  const [linkExpiry, setLinkExpiry] = React.useState("");
  const [maxDownloads, setMaxDownloads] = React.useState("");
  const [visitsFor, setVisitsFor] = React.useState<string | null>(null);

  const shares = useQuery({
    queryKey: ["file-shares", fileId],
    queryFn: () => listShares(fileId),
    enabled: open && Boolean(fileId),
  });
  const links = useQuery({
    queryKey: ["file-links", fileId],
    queryFn: () => listFileLinks(fileId),
    enabled: open && Boolean(fileId),
  });
  const visits = useQuery({
    queryKey: ["link-visits", visitsFor],
    queryFn: () => listLinkVisits(visitsFor!),
    enabled: Boolean(visitsFor),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["file-shares", fileId] });
    queryClient.invalidateQueries({ queryKey: ["file-links", fileId] });
    queryClient.invalidateQueries({ queryKey: ["shares"] });
    queryClient.invalidateQueries({ queryKey: ["links"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const invite = useMutation({
    mutationFn: () => shareFile(file!, email.trim(), permission, expiresAt || null, message.trim() || undefined),
    onSuccess: () => {
      toast.success(`Shared with ${email.trim()}`);
      setEmail("");
      setMessage("");
      setExpiresAt("");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unshare = useMutation({
    mutationFn: (shareId: string) => revokeShare(shareId),
    onSuccess: () => {
      toast.success("Access revoked");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const makeLink = useMutation({
    mutationFn: () =>
      createLink(fileId, {
        ...linkForm,
        password: linkPassword || undefined,
        expires_at: linkExpiry || undefined,
        max_downloads: maxDownloads ? Number(maxDownloads) : undefined,
      }),
    onSuccess: (data) => {
      toast.success("Public link created");
      setLinkPassword("");
      setLinkExpiry("");
      setMaxDownloads("");
      invalidate();
      void navigator.clipboard?.writeText(linkUrl(data.link)).catch(() => undefined);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const killLink = useMutation({
    mutationFn: (linkId: string) => revokeLink(linkId),
    onSuccess: () => {
      toast.success("Link revoked");
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const publicLinksAllowed = config?.policy?.allow_public_links !== false;
  const activeLinks = (links.data ?? []).filter((link) => !link.revoked_at);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">Share “{file?.filename}”</DialogTitle>
          <DialogDescription>Invite people by email or publish a link anyone can open.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="people">
          <TabsList className="w-full">
            <TabsTrigger value="people" className="flex-1">
              <UserPlus className="mr-2 h-4 w-4" /> People
            </TabsTrigger>
            <TabsTrigger value="link" className="flex-1">
              <Link2 className="mr-2 h-4 w-4" /> Public link
            </TabsTrigger>
          </TabsList>

          {/* ----------------------------------------------------- people */}
          <TabsContent value="people" className="mt-4 space-y-4">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                invite.mutate();
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  value={email}
                  required
                  onChange={(event) => setEmail(event.target.value)}
                  className="flex-1"
                />
                <Select value={permission} onValueChange={(value) => setPermission(value as "view" | "edit")}>
                  <SelectTrigger className="sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Can view</SelectItem>
                    <SelectItem value="edit">Can edit</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={invite.isPending || !email.includes("@")}>
                  {invite.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Share
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="share-expiry" className="text-xs">Expires (optional)</Label>
                  <Input
                    id="share-expiry"
                    type="date"
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="share-message" className="text-xs">Message (optional)</Label>
                  <Input
                    id="share-message"
                    placeholder="Here's the file we discussed"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                  />
                </div>
              </div>
            </form>

            <div className="rounded-lg border">
              {shares.isLoading ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (shares.data?.length ?? 0) === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">Not shared with anyone yet.</p>
              ) : (
                <ul className="divide-y">
                  {shares.data?.map((share) => (
                    <li key={share.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{share.shared_with_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {share.permission_level} · shared {formatRelativeTime(share.created_at)}
                          {share.expires_at ? ` · expires ${formatDate(share.expires_at)}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unshare.mutate(share.id)}
                        disabled={unshare.isPending}
                      >
                        <Ban className="mr-2 h-4 w-4" /> Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* ------------------------------------------------------- link */}
          <TabsContent value="link" className="mt-4 space-y-4">
            {!publicLinksAllowed ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Public links are disabled on this workspace by an administrator.
              </p>
            ) : (
              <>
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="link-expiry" className="text-xs">Expires (optional)</Label>
                      <Input id="link-expiry" type="date" value={linkExpiry} onChange={(e) => setLinkExpiry(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="link-password" className="text-xs">Password (optional)</Label>
                      <Input
                        id="link-password"
                        type="password"
                        placeholder="Leave blank for no password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="link-max" className="text-xs">Max downloads (optional)</Label>
                      <Input
                        id="link-max"
                        type="number"
                        min={1}
                        placeholder="Unlimited"
                        value={maxDownloads}
                        onChange={(e) => setMaxDownloads(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="link-note" className="text-xs">Note shown to visitors</Label>
                      <Textarea
                        id="link-note"
                        rows={1}
                        className="min-h-[40px]"
                        value={linkForm.note ?? ""}
                        onChange={(e) => setLinkForm((current) => ({ ...current, note: e.target.value }))}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={linkForm.allow_download !== false}
                      onCheckedChange={(checked) =>
                        setLinkForm((current) => ({ ...current, allow_download: checked === true }))
                      }
                    />
                    Allow downloads (uncheck for view-only)
                  </label>
                  <Button onClick={() => makeLink.mutate()} disabled={makeLink.isPending}>
                    {makeLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Create link
                  </Button>
                </div>

                <div className="rounded-lg border">
                  {links.isLoading ? (
                    <div className="p-3">
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : activeLinks.length === 0 ? (
                    <p className="p-4 text-center text-sm text-muted-foreground">No public links for this file yet.</p>
                  ) : (
                    <ul className="divide-y">
                      {activeLinks.map((link) => (
                        <li key={link.id} className="space-y-2 p-3">
                          <div className="flex items-center gap-2">
                            <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{linkUrl(link)}</code>
                            <CopyButton value={linkUrl(link)} successMessage="Link copied" />
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Link activity"
                              onClick={() => setVisitsFor(visitsFor === link.id ? null : link.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Revoke link"
                              onClick={() => killLink.mutate(link.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{link.allow_download ? "Download" : "View only"}</Badge>
                            {link.has_password ? <Badge variant="outline">Password</Badge> : null}
                            {link.expires_at ? <Badge variant="outline">Expires {formatDate(link.expires_at)}</Badge> : null}
                            <span>
                              {link.view_count} views · {link.download_count} downloads
                            </span>
                          </div>
                          {visitsFor === link.id ? (
                            <div className="rounded-md bg-muted/40 p-2 text-xs">
                              {visits.isLoading ? (
                                <Skeleton className="h-8 w-full" />
                              ) : (visits.data?.length ?? 0) === 0 ? (
                                <p className="text-muted-foreground">No visits recorded yet.</p>
                              ) : (
                                <ul className="space-y-1">
                                  {visits.data?.slice(0, 8).map((visit, index) => (
                                    <li key={index} className="flex justify-between">
                                      <span className="capitalize">{visit.action}</span>
                                      <span className="text-muted-foreground">
                                        {visit.country ?? "—"} · {formatRelativeTime(visit.created_at)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ShareDialog;
