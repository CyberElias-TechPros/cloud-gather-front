import React from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/contexts/AuthContext";

/** Query client with retries and background refetching disabled for determinism. */
export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
    logger: undefined,
  } as ConstructorParameters<typeof QueryClient>[0]);

interface ProvidersProps {
  children: React.ReactNode;
  route?: string;
  queryClient?: QueryClient;
}

/** Mirrors the provider stack in src/main.tsx so components render as they do in the app. */
export const AppProviders: React.FC<ProvidersProps> = ({ children, route = "/", queryClient }) => (
  <QueryClientProvider client={queryClient ?? createTestQueryClient()}>
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  </QueryClientProvider>
);

/** `render` with the app's providers already wrapped around the tree. */
export function renderWithProviders(
  ui: React.ReactElement,
  options: Omit<RenderOptions, "wrapper"> & { route?: string; queryClient?: QueryClient } = {},
): RenderResult {
  const { route, queryClient, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => (
      <AppProviders route={route} queryClient={queryClient}>
        {children}
      </AppProviders>
    ),
    ...rest,
  });
}
