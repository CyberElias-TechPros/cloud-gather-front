import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import PricingPage from "./PricingPage";
import { renderWithProviders } from "@/test/utils";
import { makeConfig, makePlan } from "@/test/fixtures";

const getConfig = vi.fn();

vi.mock("@/services/system", () => ({
  getConfig: () => getConfig(),
  listAnnouncements: () => Promise.resolve([]),
}));

describe("PricingPage", () => {
  beforeEach(() => {
    localStorage.clear();
    getConfig.mockReset();
    getConfig.mockResolvedValue(makeConfig());
  });

  it("renders every plan returned by the API with its real price", async () => {
    renderWithProviders(<PricingPage />, { route: "/pricing" });

    expect(await screen.findByRole("heading", { name: /pricing that scales with you/i })).toBeInTheDocument();
    // Free plan shows "Free", the 900-cent Pro plan renders as $9.
    expect((await screen.findAllByText("Pro")).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(/\$9/)).toBeInTheDocument());
  });

  it("switches to yearly pricing when the interval toggle is used", async () => {
    const { container } = renderWithProviders(<PricingPage />, { route: "/pricing" });
    await screen.findAllByText("Pro");

    const yearly = screen.getByRole("button", { name: /yearly/i });
    yearly.click();

    // 9000 cents -> $90 per year.
    await waitFor(() => expect(container.textContent).toContain("$90"));
  });

  it("labels a negatively priced plan as custom and offers sales contact", async () => {
    getConfig.mockResolvedValue(
      makeConfig({
        plans: [makePlan({ id: "enterprise", name: "Enterprise", priceMonthly: -1, priceYearly: -1, popular: false })],
      }),
    );
    renderWithProviders(<PricingPage />, { route: "/pricing" });

    expect(await screen.findByText("Custom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talk to sales/i })).toBeInTheDocument();
  });

  it("builds the limits comparison table from plan limits", async () => {
    renderWithProviders(<PricingPage />, { route: "/pricing" });
    expect(await screen.findByText(/compare plans/i)).toBeInTheDocument();
    expect(screen.getByText("Managed storage")).toBeInTheDocument();
    expect(screen.getByText("API rate limit")).toBeInTheDocument();
  });
});
