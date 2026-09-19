import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { PlatformConfig, ProviderCatalogEntry } from "@/types/api";

/**
 * Platform configuration published by the API (`/api/config`).
 *
 * Falling back to safe defaults means a slow or unreachable API never blocks the
 * first paint — the marketing site still renders, just without live limits.
 */

const FALLBACK: PlatformConfig = {
  appName: "CloudGather",
  appDescription: "One home for every cloud.",
  appVersion: "1.0.0",
  maintenanceMode: false,
  registrationEnabled: true,
  emailVerificationRequired: false,
  maxFileSizeMb: 100,
  defaultQuotaGb: 50,
  trashRetentionDays: 30,
  allowedFileTypes: [],
  supportEmail: "support@cloudgather.app",
  environment: "production",
  emailDeliveryConfigured: false,
};

interface ConfigContextValue {
  config: PlatformConfig;
  providers: ProviderCatalogEntry[];
  loaded: boolean;
  reload: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextValue>({ config: FALLBACK, providers: [], loaded: false, reload: async () => {} });

export const useConfig = () => useContext(ConfigContext);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<PlatformConfig>(FALLBACK);
  const [providers, setProviders] = useState<ProviderCatalogEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useMemo(
    () => async () => {
      try {
        const response = await api.config.get();
        setConfig(response.config);
        setProviders(response.providers);
      } catch {
        // Keep the fallback: the UI stays usable, and user-visible limits are
        // still enforced server-side.
      } finally {
        setLoaded(true);
      }
    },
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo(() => ({ config, providers, loaded, reload: load }), [config, providers, loaded, load]);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
};
