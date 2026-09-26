import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, CheckCheck, Loader2, Settings2, Trash2 } from "lucide-react";
import { Seo } from "@/components/common/Seo";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  clearRead,
  deleteNotification,
  getPreferences,
  listNotifications,
  markAllRead,
  markRead,
  savePreferences,
} from "@/services/notifications";
import { formatRelativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { NotificationPreferences } from "@/types/api";

const PREFERENCE_FIELDS: { key: keyof NotificationPreferences; label: string; help: string }[] = [
  { key: "emailSecurityAlerts", label: "Security alerts", help: "New sign-ins, password changes and 2FA updates." },
  { key: "emailSharing", label: "Sharing", help: "When someone shares a file with you or opens your link." },
  { key: "emailStorageAlerts", label: "Storage warnings", help: "When you approach your plan's storage limit." },
  { key: "emailBilling", label: "Billing", help: "Invoices, payment failures and plan changes." },
  { key: "emailProductUpdates", label: "Product updates", help: "New features and improvements." },
  { key: "emailWeeklyDigest", label: "Weekly digest", help: "A Monday summary of activity in your workspace." },
  { key: "inAppAll", label: "In-app notifications", help: "Show notifications in the bell menu." },
];

/** Notification inbox plus per-channel delivery preferences. */
const NotificationsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [onlyUnread, setOnlyUnread] = React.useState(false);

  const list = useQuery({
    queryKey: ["notifications", "page", onlyUnread],
    queryFn: () => listNotifications({ limit: 100, unread: onlyUnread || undefined }),
  });
  const preferences = useQuery({ queryKey: ["notification-preferences"], queryFn: getPreferences });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const read = useMutation({ mutationFn: markRead, onSuccess: invalidate });
  const readAll = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      toast.success("All caught up");
      invalidate();
    },
  });
  const remove = useMutation({ mutationFn: deleteNotification, onSuccess: invalidate });
  const clear = useMutation({
    mutationFn: clearRead,
    onSuccess: () => {
      toast.success("Read notifications cleared");
      invalidate();
    },
  });

  const save = useMutation({
    mutationFn: (changes: Partial<NotificationPreferences>) => savePreferences(changes),
    onSuccess: () => {
      toast.success("Preferences saved");
      queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const items = list.data?.notifications ?? [];
  const unread = list.data?.unread ?? 0;
  const prefs = preferences.data?.preferences;

  return (
    <div className="space-y-6">
      <Seo title="Notifications" description="Your CloudGather notifications and email preferences." path="/notifications" noIndex />
      <PageHeader
        title="Notifications"
        icon={Bell}
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        actions={
          <>
            <Button variant="outline" onClick={() => readAll.mutate()} disabled={readAll.isPending || unread === 0}>
              <CheckCheck className="mr-2 h-4 w-4" /> Mark all read
            </Button>
            <Button variant="outline" onClick={() => clear.mutate()} disabled={clear.isPending || items.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear read
            </Button>
          </>
        }
      />

      <Tabs defaultValue="inbox">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="preferences">
            <Settings2 className="mr-2 h-4 w-4" /> Preferences
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Switch id="unread-only" checked={onlyUnread} onCheckedChange={setOnlyUnread} />
            <Label htmlFor="unread-only" className="text-sm font-normal text-muted-foreground">
              Show unread only
            </Label>
          </div>

          <Card>
            <CardContent className="p-0">
              {list.isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}
                </div>
              ) : items.length === 0 ? (
                <EmptyState
                  className="border-0"
                  icon={BellOff}
                  title={onlyUnread ? "No unread notifications" : "No notifications yet"}
                  description="Sharing, storage and security events will show up here."
                />
              ) : (
                <ul className="divide-y">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={cn("flex items-start gap-3 p-4 transition-colors", !item.read_at && "bg-primary/5")}
                    >
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", item.read_at ? "bg-muted" : "bg-primary")} />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          if (!item.read_at) read.mutate(item.id);
                          if (item.link) navigate(item.link);
                        }}
                      >
                        <p className="text-sm font-medium">{item.title}</p>
                        {item.body ? <p className="text-sm text-muted-foreground">{item.body}</p> : null}
                        <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(item.created_at)}</p>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete notification"
                        onClick={() => remove.mutate(item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Email &amp; in-app delivery</CardTitle>
              <CardDescription>Choose what we contact you about. Security alerts are always recommended.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {preferences.isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
                </div>
              ) : (
                PREFERENCE_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-start justify-between gap-4 border-b py-3 last:border-0">
                    <div className="min-w-0">
                      <Label htmlFor={field.key} className="text-sm font-medium">{field.label}</Label>
                      <p className="text-xs text-muted-foreground">{field.help}</p>
                    </div>
                    <Switch
                      id={field.key}
                      checked={Boolean(prefs?.[field.key])}
                      disabled={save.isPending}
                      onCheckedChange={(checked) => save.mutate({ [field.key]: checked } as Partial<NotificationPreferences>)}
                    />
                  </div>
                ))
              )}
              {save.isPending ? (
                <p className="flex items-center gap-2 pt-3 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Saving…
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;
