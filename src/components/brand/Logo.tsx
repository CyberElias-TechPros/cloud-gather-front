import React from "react";
import { Link } from "react-router-dom";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/** The CloudGather mark — several small clouds converging into one. */
export const LogoMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="cg-grad" x1="4" y1="26" x2="28" y2="6" gradientUnits="userSpaceOnUse">
        <stop stopColor="hsl(243 68% 55%)" />
        <stop offset="1" stopColor="hsl(191 91% 42%)" />
      </linearGradient>
    </defs>
    <path
      d="M9.5 24.5h13.75a5.25 5.25 0 0 0 .9-10.43A8.25 8.25 0 0 0 8.2 12.2a6.16 6.16 0 0 0 1.3 12.3Z"
      fill="url(#cg-grad)"
    />
    <path
      d="M11 8.6a3.1 3.1 0 0 1 5.6-1.24A3.9 3.9 0 0 1 23 9.06a3.32 3.32 0 0 1-.6 6.58"
      stroke="url(#cg-grad)"
      strokeWidth="2.1"
      strokeLinecap="round"
      opacity="0.55"
    />
  </svg>
);

interface LogoProps {
  /** Render as a link to "/" (default) or plain span when inside another link. */
  asLink?: boolean;
  showWordmark?: boolean;
  className?: string;
  markClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({ asLink = true, showWordmark = true, className, markClassName }) => {
  const content = (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className={cn("h-7 w-7 shrink-0", markClassName)} />
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight">
          Cloud<span className="text-gradient">Gather</span>
        </span>
      )}
    </span>
  );
  if (!asLink) return content;
  return (
    <Link to="/" aria-label={`${siteConfig.name} — home`} className="rounded-md">
      {content}
    </Link>
  );
};
