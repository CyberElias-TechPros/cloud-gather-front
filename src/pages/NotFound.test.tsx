import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";
import { AuthProvider } from "@/contexts/AuthContext";

// The marketing layout reads auth state; stub the Supabase client so the
// AuthProvider resolves to a signed-out state without network access.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      getSession: async () => ({ data: { session: null } }),
    },
    from: () => ({}),
    rpc: async () => ({ data: false, error: null }),
  },
}));

function renderNotFound(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <NotFound />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("NotFound page", () => {
  it("renders a friendly 404 with working links", () => {
    renderNotFound("/definitely-not-a-page");
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByText("/definitely-not-a-page")).toBeInTheDocument();
    const home = screen.getByRole("link", { name: /back to home/i });
    expect(home).toHaveAttribute("href", "/");
  });

  it("is excluded from search indexes", () => {
    renderNotFound("/missing");
    const robots = document.head.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    expect(robots).toContain("noindex");
  });
});
