import React from "react";
import { Megaphone, X } from "lucide-react";
import { useAppConfig } from "@/hooks/useAppConfig";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cg:dismissed-announcement";

/**
 * Site-wide banner for the active announcement (or maintenance notice)
 * published from the admin console. Dismissal is remembered per message.
 */
export const AnnouncementBanner: React.FC = () => {
  const { data } = useAppConfig();
  const [dismissed, setDismissed] = React.useState<string | null>(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const maintenance = data?.policy?.maintenance_mode ? data.policy.maintenance_message : null;
  const message = maintenance || data?.announcement || null;
  if (!message || (!maintenance && dismissed === message)) return null;

  return (
    <div
      role="status"
      className={
        maintenance
          ? "flex items-center gap-3 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
          : "flex items-center gap-3 bg-primary/10 px-4 py-2 text-sm text-primary"
      }
    >
      <Megaphone className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="flex-1 leading-snug">{message}</p>
      {!maintenance ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Dismiss announcement"
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, message);
            } catch {
              /* ignore storage failures */
            }
            setDismissed(message);
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
};

export default AnnouncementBanner;
