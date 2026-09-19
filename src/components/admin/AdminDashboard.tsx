import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Users, FileText, HardDrive, Activity, AlertCircle, Newspaper } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/format";

interface AdminStats {
  userCount: number;
  fileCount: number;
  providerCount: number;
  blogCount: number;
  recentActivities: { id: string; action: string; resource_type: string; created_at: string }[];
  degraded: boolean;
}

const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      const [users, files, providers, blog, activity] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("files").select("id", { count: "exact", head: true }),
        supabase.from("storage_providers").select("id", { count: "exact", head: true }),
        supabase.from("blog_posts").select("id", { count: "exact", head: true }),
        supabase
          .from("audit_logs")
          .select("id, action, resource_type, created_at")
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      // Under RLS a blocked count surfaces as an error — track it so the UI can
      // be honest about degraded data instead of silently showing zeros.
      const failed = [users.error, files.error, providers.error, blog.error].some(Boolean);

      return {
        userCount: users.count ?? 0,
        fileCount: files.count ?? 0,
        providerCount: providers.count ?? 0,
        blogCount: blog.count ?? 0,
        recentActivities: (activity.data ?? []) as AdminStats["recentActivities"],
        degraded: failed,
      };
    },
    refetchInterval: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const cards = [
    { title: "Total users", value: stats?.userCount ?? 0, icon: Users, note: "Registered accounts" },
    { title: "Files catalogued", value: stats?.fileCount ?? 0, icon: FileText, note: "Across all users" },
    { title: "Provider connections", value: stats?.providerCount ?? 0, icon: HardDrive, note: "All statuses" },
    { title: "Blog posts", value: stats?.blogCount ?? 0, icon: Newspaper, note: "Published" },
  ];

  return (
    <div className="space-y-4">
      {stats?.degraded && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Some counters are unavailable</AlertTitle>
          <AlertDescription>
            One or more admin read policies are missing on the server, so these numbers may be incomplete. See
            the deployment guide — the consolidated migration adds the required policies.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{card.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{card.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent activity</CardTitle>
          <CardDescription>Latest recorded actions across the platform.</CardDescription>
        </CardHeader>
        <CardContent>
          {stats?.recentActivities.length ? (
            <ul className="space-y-3">
              {stats.recentActivities.map((activity) => (
                <li key={activity.id} className="flex items-center gap-3 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {activity.action} <span className="text-muted-foreground">· {activity.resource_type}</span>
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={activity.created_at}>
                    {formatDateTime(activity.created_at)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity recorded yet. Actions appear here as users work with files.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
