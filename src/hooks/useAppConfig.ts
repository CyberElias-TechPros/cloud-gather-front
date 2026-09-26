import { useQuery } from "@tanstack/react-query";
import { getConfig } from "@/services/system";
import type { AppConfig } from "@/types/api";

/**
 * Public runtime configuration: which integrations are wired up, what the
 * policy limits are, and the plan catalogue. Cached aggressively — it only
 * changes when an administrator edits settings or a secret is deployed.
 */
export function useAppConfig() {
  return useQuery<AppConfig>({
    queryKey: ["app-config"],
    queryFn: getConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/** True when a named platform capability is available on this deployment. */
export function useCapability(name: "email" | "encryption" | "billing" | "turnstile") {
  const { data } = useAppConfig();
  return Boolean(data?.capabilities?.[name]);
}
