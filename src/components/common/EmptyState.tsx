import React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Friendly placeholder for lists with nothing in them (never a dead end). */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center", className)}>
    {Icon ? (
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
    ) : null}
    <h3 className="text-base font-semibold">{title}</h3>
    {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    {action ? <div className="mt-5">{action}</div> : null}
  </div>
);

export default EmptyState;
