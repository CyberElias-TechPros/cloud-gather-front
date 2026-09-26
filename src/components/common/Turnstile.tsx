import React from "react";

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: { sitekey: string; callback: (token: string) => void; "error-callback"?: () => void; theme?: string },
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onloadTurnstileCallback?: () => void;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Cloudflare Turnstile widget. Renders nothing when the deployment has no
 * site key configured, so forms still work in development.
 */
export const Turnstile: React.FC<{ siteKey?: string | null; onToken: (token: string) => void }> = ({ siteKey, onToken }) => {
  const container = React.useRef<HTMLDivElement>(null);
  const widget = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!siteKey || !container.current) return;
    let cancelled = false;

    loadTurnstile()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widget.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          "error-callback": () => onToken(""),
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) {
        try {
          window.turnstile.remove(widget.current);
        } catch {
          /* widget already gone */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  if (!siteKey) return null;
  return <div ref={container} className="min-h-[65px]" />;
};

export default Turnstile;
