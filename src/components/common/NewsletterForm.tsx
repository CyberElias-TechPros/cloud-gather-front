import React from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeNewsletter } from "@/services/system";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface NewsletterFormProps {
  /** Recorded against the subscription so we know where it came from. */
  source?: string;
  className?: string;
}

/** Product-update signup. Posts to /api/newsletter; unsubscribe lives at /unsubscribe. */
export const NewsletterForm: React.FC<NewsletterFormProps> = ({ source = "footer", className }) => {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const subscribe = useMutation({
    mutationFn: () => subscribeNewsletter(email.trim(), source),
    onSuccess: (data) => {
      toast.success(data.message || "You're on the list");
      setEmail("");
    },
    onError: (mutationError) => {
      const message = errorMessage(mutationError);
      setError(message);
      toast.error(message);
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    subscribe.mutate();
  };

  if (subscribe.isSuccess) {
    return (
      <p className={cn("flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400", className)}>
        <CircleCheck className="h-4 w-4" /> Subscribed — check your inbox to confirm.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className={cn("space-y-2", className)} noValidate>
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          aria-label="Email address"
          aria-invalid={error ? true : undefined}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
        />
        <Button type="submit" disabled={subscribe.isPending} aria-label="Subscribe">
          {subscribe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </form>
  );
};

export default NewsletterForm;
