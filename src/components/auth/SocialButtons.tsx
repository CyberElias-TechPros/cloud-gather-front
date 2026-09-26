import React from "react";
import { Button } from "@/components/ui/button";
import { useAuth, type Provider } from "@/contexts/AuthContext";
import { useAppConfig } from "@/hooks/useAppConfig";
import { toast } from "sonner";
import { Github, Loader2 } from "lucide-react";

const GoogleGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6v-3h-4a12 12 0 0 0 0 10.7l4-3.1Z" />
    <path fill="#EA4335" d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
  </svg>
);

const MicrosoftGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
    <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
    <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
    <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
  </svg>
);

const SOCIALS: { id: Provider; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "google", label: "Google", icon: GoogleGlyph },
  { id: "microsoft", label: "Microsoft", icon: MicrosoftGlyph },
  { id: "github", label: "GitHub", icon: ({ className }) => <Github className={className} /> },
];

/**
 * Social sign-in buttons. Only providers whose credentials are configured on
 * the deployment are shown, so the UI never offers a broken button.
 */
export const SocialButtons: React.FC<{ redirectTo?: string; disabled?: boolean }> = ({ redirectTo, disabled }) => {
  const { signInWithProvider } = useAuth();
  const { data: config } = useAppConfig();
  const [busy, setBusy] = React.useState<string | null>(null);

  const enabled = SOCIALS.filter((social) => config?.capabilities?.social?.[social.id]);
  if (enabled.length === 0) return null;

  const start = async (provider: Provider) => {
    setBusy(provider);
    const target = redirectTo || `${window.location.origin}/auth/callback`;
    const { error } = await signInWithProvider(provider, target);
    if (error) {
      toast.error(error.message || "That sign-in provider is unavailable right now.");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {enabled.map((social) => (
          <Button
            key={social.id}
            type="button"
            variant="outline"
            className="w-full"
            disabled={disabled || busy !== null}
            onClick={() => start(social.id)}
          >
            {busy === social.id ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <social.icon className="mr-2 h-4 w-4" />
            )}
            {social.label}
          </Button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
        </div>
      </div>
    </div>
  );
};

export default SocialButtons;
