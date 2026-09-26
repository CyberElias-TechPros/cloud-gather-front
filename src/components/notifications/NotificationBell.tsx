import React from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, useUnreadNotifications } from "@/hooks/useNotifications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Header bell: unread badge, latest ten notifications, quick mark-as-read. */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const unread = useUnreadNotifications();
  const { data, isLoading, markRead, markAllRead } = useNotifications(10);

  const count = unread.data ?? 0;
  const items = data?.notifications ?? [];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={count > 0 ? `Notifications (${count} unread)` : "Notifications"}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {count > 0 ? (
            <Badge
              variant="destructive"
              className="absolute right-1 top-1 h-4 min-w-[1rem] justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {count > 9 ? "9+" : count}
            </Badge>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between py-3">
          <span>Notifications</span>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={(event) => {
                event.preventDefault();
                markAllRead.mutate();
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      !item.read_at && "bg-primary/5",
                    )}
                    onClick={() => {
                      if (!item.read_at) markRead.mutate(item.id);
                      setOpen(false);
                      if (item.link) navigate(item.link);
                      else navigate("/notifications");
                    }}
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{item.title}</span>
                      {!item.read_at ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
                    </span>
                    {item.body ? (
                      <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">{formatRelativeTime(item.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
