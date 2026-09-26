import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  Cloud,
  FileText,
  FolderOpen,
  HardDrive,
  Loader2,
  Share2,
  Sparkles,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/contexts/AuthContext";
import { completeOnboarding, getDashboard, getOnboarding } from "@/services/account";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { getProviderIcon, getProviderName } from "@/lib/providers";
import { fileIconFor } from "@/lib/fileIcons";
import { errorMessage } from "@/lib/api";
import { toast } from "sonner";

const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
}> = ({ label, value, hint, icon: Icon, to }) => {
  const body = (
    <Card className="h-full transition-colors hover:border-primary/40">
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
          {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
};

/** Home screen for signed-in users: usage, onboarding, recent work. */
const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const dashboard = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard });
  const onboarding = useQuery({ queryKey: ["onboarding"], queryFn: getOnboarding });

  const finishOnboarding = useMutation({
    mutationFn: completeOnboarding,
    onSuccess: () => {
      toast.success("Setup complete — happy gathering!");
      queryClient.invalidateQueries({ queryKey: ["onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const data = dashboard.data;
  const usage = data?.entitlements?.usage;
  const limits = data?.entitlements?.limits;
  const percent = data?.entitlements?.storage_percent ?? 0;
  const firstName = (user?.display_name || user?.email || "there").split(/[\s@]/)[0];
  const steps = onboarding.data?.steps ?? [];
  const remaining = steps.filter((step) => !step.done && !step.optional);

  if (dashboard.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" />
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>We couldn&apos;t load your dashboard</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{errorMessage(dashboard.error)}</span>
            <Button variant="outline" className="w-fit" onClick={() => dashboard.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Seo title="Dashboard" description="Your CloudGather workspace at a glance." path="/dashboard" noIndex />

      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Everything across your connected clouds, in one place."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/providers")}>
              <Cloud className="mr-2 h-4 w-4" /> Connect a drive
            </Button>
            <Button onClick={() => navigate("/files?upload=1")}>
              <Upload className="mr-2 h-4 w-4" /> Upload files
            </Button>
          </>
        }
      />

      {data?.announcement ? (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>{data.announcement.title}</AlertTitle>
          <AlertDescription>{data.announcement.body}</AlertDescription>
        </Alert>
      ) : null}

      {/* Onboarding checklist */}
      {!onboarding.isLoading && steps.length > 0 && !data?.onboarding_complete ? (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Finish setting up</CardTitle>
              <CardDescription>
                {remaining.length === 0
                  ? "All done — mark your setup as complete."
                  : `${remaining.length} step${remaining.length === 1 ? "" : "s"} left to get the most out of CloudGather.`}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant={remaining.length === 0 ? "default" : "ghost"}
              onClick={() => finishOnboarding.mutate()}
              disabled={finishOnboarding.isPending}
            >
              {finishOnboarding.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {remaining.length === 0 ? "Mark complete" : "Skip for now"}
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {steps.map((step) => (
              <Link
                key={step.id}
                to={step.href}
                className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm transition-colors hover:border-primary/40"
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <span className={step.done ? "text-muted-foreground line-through" : "font-medium"}>{step.label}</span>
                {step.optional ? <Badge variant="outline" className="ml-auto text-[10px]">Optional</Badge> : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dashboard.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[92px] w-full rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Files"
              value={String(usage?.fileCount ?? 0)}
              hint={`${usage?.folderCount ?? 0} folders`}
              icon={FileText}
              to="/files"
            />
            <StatCard
              label="Storage used"
              value={formatBytes(usage?.storageBytes ?? 0)}
              hint={limits ? `of ${formatBytes(limits.storageBytes)}` : undefined}
              icon={HardDrive}
              to="/storage"
            />
            <StatCard
              label="Connected drives"
              value={String(usage?.providerCount ?? 0)}
              hint={limits ? `up to ${limits.maxProviders}` : undefined}
              icon={Cloud}
              to="/providers"
            />
            <StatCard
              label="Shares"
              value={String(usage?.shareCount ?? 0)}
              hint={`${usage?.publicLinkCount ?? 0} public links`}
              icon={Share2}
              to="/shared"
            />
          </>
        )}
      </div>

      {/* Storage meter */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Storage</CardTitle>
              <CardDescription>
                {formatBytes(usage?.storageBytes ?? 0)} of {formatBytes(limits?.storageBytes ?? 0)} used on the{" "}
                <span className="capitalize">{data?.entitlements?.plan?.name ?? "Free"}</span> plan
              </CardDescription>
            </div>
            {data?.billing_enabled ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/billing">
                  Manage plan <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={Math.min(percent, 100)} className="h-2" />
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>{percent.toFixed(1)}% used</span>
            {usage?.trashBytes ? (
              <span>
                {formatBytes(usage.trashBytes)} in <Link className="underline" to="/trash">trash</Link>
              </span>
            ) : null}
          </div>
          {percent >= 90 ? (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertTitle>You&apos;re nearly out of space</AlertTitle>
              <AlertDescription>
                Empty your trash or{" "}
                <Link className="underline" to="/billing">upgrade your plan</Link> to keep uploading.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent files */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-lg">Recent files</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/recents">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
              </div>
            ) : (data?.recent_files?.length ?? 0) === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No files yet"
                description="Upload a file or connect a cloud drive to see your content here."
                action={
                  <Button onClick={() => navigate("/files?upload=1")}>
                    <Upload className="mr-2 h-4 w-4" /> Upload your first file
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {data?.recent_files?.slice(0, 8).map((file) => {
                  const Icon = fileIconFor(file);
                  return (
                    <li key={file.id}>
                      <Link
                        to={file.is_folder ? `/files/${file.id}` : `/files?file=${file.id}`}
                        className="flex items-center gap-3 py-2.5 transition-colors hover:bg-muted/40"
                      >
                        <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{file.filename}</span>
                          <span className="block text-xs text-muted-foreground">
                            {file.is_folder ? "Folder" : formatBytes(file.size)} ·{" "}
                            {formatRelativeTime(file.updated_at || file.created_at)}
                          </span>
                        </span>
                        {file.provider_name ? (
                          <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
                            {getProviderName(file.provider_name)}
                          </Badge>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Side column */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-lg">Connected drives</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/providers">Manage</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(data?.providers?.length ?? 0) === 0 ? (
                <EmptyState
                  className="border-0 px-0 py-6"
                  icon={Cloud}
                  title="No drives connected"
                  description="Bring Google Drive, Dropbox, OneDrive, S3 and more into one library."
                  action={
                    <Button size="sm" onClick={() => navigate("/providers")}>
                      Connect a drive
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {data?.providers?.map((provider) => {
                    const Icon = getProviderIcon(provider.provider_name);
                    return (
                      <li key={provider.id} className="flex items-center gap-3">
                        <Icon className="h-6 w-6 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {provider.display_name || getProviderName(provider.provider_name)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {provider.file_count} files
                            {provider.used_space ? ` · ${formatBytes(provider.used_space)}` : ""}
                          </p>
                        </div>
                        <Badge variant={provider.status === "error" ? "destructive" : "secondary"}>
                          {provider.status}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-lg">Shared with me</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/shared">View</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {(data?.shared_with_me?.length ?? 0) === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Nothing has been shared with you yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data?.shared_with_me?.slice(0, 5).map((share) => (
                    <li key={share.id} className="flex items-center gap-3">
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{share.filename}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          from {share.shared_by} · {share.permission_level}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.recent_activity?.length ?? 0) === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Your account activity will appear here.</p>
              ) : (
                <ul className="space-y-3">
                  {data?.recent_activity?.slice(0, 6).map((event) => (
                    <li key={event.id} className="flex items-start gap-3 text-sm">
                      <Activity className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium capitalize">{event.action.replace(/[._]/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeTime(event.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
