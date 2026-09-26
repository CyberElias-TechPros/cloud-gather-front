import React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  value: string;
  label?: string;
  successMessage?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}

/** Copies text to the clipboard with a graceful fallback for insecure origins. */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export const CopyButton: React.FC<CopyButtonProps> = ({
  value,
  label,
  successMessage = "Copied to clipboard",
  size = "icon",
  variant = "outline",
  className,
}) => {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      size={label ? (size === "icon" ? "sm" : size) : size}
      variant={variant}
      className={cn(className)}
      onClick={async () => {
        const ok = await copyText(value);
        if (ok) {
          setCopied(true);
          toast.success(successMessage);
        } else {
          toast.error("Copy failed — select the text and copy manually.");
        }
      }}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {label ? <span className="ml-2">{label}</span> : <span className="sr-only">Copy</span>}
    </Button>
  );
};

export default CopyButton;
