import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Lock, ShieldOff, TriangleAlert } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadPublicLink, unlockPublicLink, viewPublicLink } from "@/services/shares";
import { apiUrl, errorMessage } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import { fileIconFor } from "@/lib/fileIcons";
import { siteConfig } from "@/lib/site";
import { isPreviewableImage } from "@/lib/format";
import { toast } from "sonner";

const ACCESS_PREFIX = "cg:link-access:";

/** Anonymous viewer for a shared public link (`/l/:token`). */
const PublicLinkPage: React.FC = () => {
  const { token = "" } = useParams();
  const [access, setAccess] = React.useState<string | undefined>(() => {
    try {
      return window.sessionStorage.getItem(ACCESS_PREFIX + token) ?? undefined;
    } catch {
      return undefined;
    }
  });
  const [password, setPassword] = React.useState("");
  const [unlocking, setUnlocking] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);

  const view = useQuery({
    queryKey: ["public-link", token, access],
    queryFn: () => viewPublicLink(token, access),
    retry: false,
    enabled: Boolean(token),
  });

  const unlock = async (event: React.FormEvent) => {
    event.preventDefault();
    setUnlocking(true);
    try {
      const result = await unlockPublicLink(token, password);
      try {
        window.sessionStorage.setItem(ACCESS_PREFIX + token, result.access);
      } catch {
        /* session storage may be unavailable */
      }
      setAccess(result.access);
      setPassword("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUnlocking(false);
    }
  };

  const download = async () => {
    if (!view.data) return;
    setDownloading(true);
    try {
      await downloadPublicLink(token, view.data.file.filename, access);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const needsPassword =
    view.isError && /password/i.test(errorMessage(view.error)) ? true : Boolean(view.data?.link.requires_password && !access);

  const file = view.data?.file;
  const Icon = file ? fileIconFor(file) : Lock;
  const previewable = file ? isPreviewableImage(file.mime_type, file.filename) : false;

  return (
    <div className="flex min-h-screen flex-col bg-dotted">
      <Seo
        title={file ? file.filename : "Shared file"}
        description="A file shared with you through CloudGather."
        path={`/l/${token}`}
        noIndex
      />
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label={`${siteConfig.name} home`}>
            <Logo />
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link to="/register">Get {siteConfig.name} free</Link>
          </Button>
        </div>
      </header>

      <main className="container flex max-w-xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        {view.isLoading ? (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ) : needsPassword ? (
          <Card>
            <CardHeader className="text-center">
              <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
              <CardTitle className="pt-2">This link is password protected</CardTitle>
              <CardDescription>Enter the password you were given to view the file.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={unlock} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="link-password">Password</Label>
                  <Input
                    id="link-password"
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={unlocking || !password}>
                  {unlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Unlock
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : view.isError ? (
          <Card>
            <CardHeader className="text-center">
              <ShieldOff className="mx-auto h-10 w-10 text-destructive" />
              <CardTitle className="pt-2">This link isn&apos;t available</CardTitle>
              <CardDescription>{errorMessage(view.error)}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button className="w-full" asChild>
                <Link to="/">Go to {siteConfig.name}</Link>
              </Button>
            </CardFooter>
          </Card>
        ) : file ? (
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl">{file.filename}</CardTitle>
                  <CardDescription>
                    {formatBytes(file.size)} · shared by {view.data?.owner.display_name}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewable ? (
                <img
                  src={apiUrl(`/public/links/${encodeURIComponent(token)}/download${access ? `?access=${encodeURIComponent(access)}` : ""}`)}
                  alt={file.filename}
                  className="max-h-80 w-full rounded-lg border object-contain"
                  loading="lazy"
                />
              ) : null}

              {view.data?.link.note ? (
                <p className="rounded-md bg-muted/50 p-3 text-sm">{view.data.link.note}</p>
              ) : null}

              <dl className="grid gap-2 text-sm text-muted-foreground">
                {view.data?.link.expires_at ? (
                  <div className="flex justify-between">
                    <dt>Expires</dt>
                    <dd>{formatDate(view.data.link.expires_at)}</dd>
                  </div>
                ) : null}
                {view.data?.link.downloads_remaining !== null && view.data?.link.downloads_remaining !== undefined ? (
                  <div className="flex justify-between">
                    <dt>Downloads remaining</dt>
                    <dd>{view.data.link.downloads_remaining}</dd>
                  </div>
                ) : null}
              </dl>

              {view.data?.link.allow_download ? (
                <Button className="w-full" onClick={download} disabled={downloading}>
                  {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download file
                </Button>
              ) : (
                <p className="flex items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  <TriangleAlert className="h-4 w-4" /> The owner disabled downloads for this link.
                </p>
              )}
            </CardContent>
            <CardFooter className="justify-center border-t pt-4 text-xs text-muted-foreground">
              Shared securely with {siteConfig.name}
            </CardFooter>
          </Card>
        ) : null}
      </main>
    </div>
  );
};

export default PublicLinkPage;
