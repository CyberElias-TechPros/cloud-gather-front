import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Ban,
  Download,
  ExternalLink,
  Eye,
  Link2,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { CopyButton } from "@/components/common/CopyButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  downloadSharedFile,
  listLinks,
  listReceivedShares,
  listSentShares,
  revokeLink,
  revokeShare,
} from "@/services/shares";
import { formatBytes, formatDate, formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";
import type { PublicLink, ShareRecord } from "@/types/api";

const expiryLabel = (value: string | null) => (value ? `Expires ${formatDate(value)}` : "No expiry");

/** Everything the user has shared, been given access to, or published as a link. */
const SharedPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [revokeTarget, setRevokeTarget] = React.useState<{ kind: "share" | "link"; id: string; label: string } | null>(null);

  const received = useQuery({ queryKey: ["shares", "received"], queryFn: listReceivedShares });
  const sent = useQuery({ queryKey: ["shares", "sent"], queryFn: listSentShares });
  const links = useQuery({ queryKey: ["links"], queryFn: listLinks });

  const revoke = useMutation({
    mutationFn: async () => {
      if (!revokeTarget) return;
      if (revokeTarget.kind === "share") await revokeShare(revokeTarget.id);
      else await revokeLink(revokeTarget.id);
    },
    onSuccess: () => {
      toast.success("Access revoked");
      setRevokeTarget(null);
      queryClient.invalidateQueries({ queryKey: ["shares"] });
      queryClient.invalidateQueries({ queryKey: ["links"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const download = async (share: ShareRecord) => {
    try {
      await downloadSharedFile(share.id, share.filename ?? "download");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const linkUrl = (link: PublicLink) => link.url || `${window.location.origin}/l/${link.token ?? link.token_prefix}`;

  const activeLinks = (links.data ?? []).filter((link) => !link.revoked_at);

  return (
    <div className="space-y-6">
      <Seo title="Shared" description="Files shared with you, files you shared and your public links." path="/shared" noIndex />
      <PageHeader
        title="Shared"
        icon={Share2}
        description="Manage who can reach your files and what other people have sent you."
        actions={
          <Button asChild variant="outline">
            <Link to="/files">Go to files</Link>
          </Button>
        }
      />

      <Tabs defaultValue="received">
        <TabsList>
          <TabsTrigger value="received">
            Shared with me {received.data?.length ? `(${received.data.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="sent">
            Shared by me {sent.data?.length ? `(${sent.data.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="links">
            Public links {activeLinks.length ? `(${activeLinks.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* ---------------------------------------------------- received */}
        <TabsContent value="received" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {received.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                </div>
              ) : (received.data?.length ?? 0) === 0 ? (
                <EmptyState
                  className="border-0"
                  icon={Users}
                  title="Nothing shared with you yet"
                  description="When a teammate shares a file with your email address it shows up here."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead className="hidden sm:table-cell">From</TableHead>
                      <TableHead className="hidden md:table-cell">Access</TableHead>
                      <TableHead className="hidden md:table-cell">Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {received.data?.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell className="font-medium">
                          <span className="block truncate">{share.filename ?? "Shared file"}</span>
                          <span className="text-xs text-muted-foreground">{formatBytes(share.size ?? 0)}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          {share.owner_name || share.owner_email || "Unknown"}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="secondary" className="capitalize">{share.permission_level}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {expiryLabel(share.expires_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => download(share)}>
                            <Download className="mr-2 h-4 w-4" /> Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------------- sent */}
        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {sent.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                </div>
              ) : (sent.data?.length ?? 0) === 0 ? (
                <EmptyState
                  className="border-0"
                  icon={Share2}
                  title="You haven't shared anything"
                  description="Open a file in your library and choose Share to give someone access."
                  action={
                    <Button asChild>
                      <Link to="/files">Browse files</Link>
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead className="hidden sm:table-cell">Shared with</TableHead>
                      <TableHead className="hidden md:table-cell">Access</TableHead>
                      <TableHead className="hidden lg:table-cell">Opened</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sent.data?.map((share) => (
                      <TableRow key={share.id} className={share.revoked_at ? "opacity-60" : undefined}>
                        <TableCell className="font-medium">
                          <span className="block truncate">{share.filename ?? "File"}</span>
                          <span className="text-xs text-muted-foreground">{expiryLabel(share.expires_at)}</span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{share.shared_with_email}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={share.revoked_at ? "outline" : "secondary"} className="capitalize">
                            {share.revoked_at ? "revoked" : share.permission_level}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {share.access_count > 0
                            ? `${share.access_count}× · ${formatRelativeTime(share.last_accessed_at)}`
                            : "Not opened yet"}
                        </TableCell>
                        <TableCell className="text-right">
                          {share.revoked_at ? null : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setRevokeTarget({ kind: "share", id: share.id, label: share.shared_with_email ?? "this person" })
                              }
                            >
                              <Ban className="mr-2 h-4 w-4" /> Revoke
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------- links */}
        <TabsContent value="links" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {links.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                </div>
              ) : activeLinks.length === 0 ? (
                <EmptyState
                  className="border-0"
                  icon={Link2}
                  title="No public links"
                  description="Create a link from any file to share it with people who don't have an account."
                  action={
                    <Button asChild>
                      <Link to="/files">Browse files</Link>
                    </Button>
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead className="hidden md:table-cell">Link</TableHead>
                      <TableHead className="hidden sm:table-cell">Usage</TableHead>
                      <TableHead className="hidden lg:table-cell">Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeLinks.map((link) => (
                      <TableRow key={link.id}>
                        <TableCell className="font-medium">
                          <span className="block truncate">{link.filename ?? "File"}</span>
                          <span className="text-xs text-muted-foreground">
                            {link.has_password ? "Password protected · " : ""}
                            {link.allow_download ? "Download allowed" : "View only"}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">/l/{link.token_prefix}…</code>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3.5 w-3.5" /> {link.view_count}
                            <Download className="ml-2 h-3.5 w-3.5" /> {link.download_count}
                            {link.max_downloads ? ` / ${link.max_downloads}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {expiryLabel(link.expires_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <CopyButton value={linkUrl(link)} successMessage="Link copied" />
                            <Button variant="ghost" size="icon" asChild>
                              <a href={linkUrl(link)} target="_blank" rel="noreferrer" aria-label="Open link">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Revoke link"
                              onClick={() => setRevokeTarget({ kind: "link", id: link.id, label: link.filename ?? "this link" })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke access?"
        description={`${revokeTarget?.label ?? "This recipient"} will immediately lose access. This cannot be undone.`}
        confirmLabel={revoke.isPending ? "Revoking…" : "Revoke"}
        destructive
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </div>
  );
};

export default SharedPage;
