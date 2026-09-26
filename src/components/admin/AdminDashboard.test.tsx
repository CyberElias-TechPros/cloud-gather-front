import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";
import { renderWithProviders } from "@/test/utils";
import type { AdminStats } from "@/services/admin";

const getStats = vi.fn();

vi.mock("@/services/admin", () => ({
  getStats: () => getStats(),
}));

const stats = (overrides: Partial<AdminStats> = {}): AdminStats => ({
  userCount: 42,
  fileCount: 108,
  providerCount: 7,
  blogCount: 6,
  recentActivities: [
    { id: "a1", action: "user.login", resource_type: "user", severity: "info", actor_email: "a@b.c", created_at: new Date().toISOString() },
  ],
  degraded: false,
  metrics: {
    managed_storage_bytes: 5 * 1024 ** 3,
    trash_bytes: 1024 ** 3,
    active_sessions: 3,
    pending_emails: 2,
    failed_webhooks_24h: 0,
    open_tickets: 1,
    plans: [{ plan: "free", total: 40 }, { plan: "pro", total: 2 }],
  },
  charts: {
    signups_by_day: [{ day: "2026-09-01", total: 4 }],
    uploads_by_day: [{ day: "2026-09-01", total: 9, bytes: 1024 }],
  },
  health: { database: true, storage: true },
  ...overrides,
});

describe("AdminDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    getStats.mockReset();
    getStats.mockResolvedValue(stats());
  });

  it("renders the platform counters from the API", async () => {
    renderWithProviders(<AdminDashboard />);

    expect(await screen.findByText("42")).toBeInTheDocument();
    expect(screen.getByText("108")).toBeInTheDocument();
    expect(screen.getByText("5 GB")).toBeInTheDocument();
  });

  it("shows a degraded banner when a health check fails", async () => {
    getStats.mockResolvedValue(stats({ degraded: true, health: { database: false, storage: true } }));
    renderWithProviders(<AdminDashboard />);

    expect(await screen.findByText(/platform is degraded/i)).toBeInTheDocument();
    expect(screen.getByText(/database checks are failing/i)).toBeInTheDocument();
    expect(screen.getByText("Failing")).toBeInTheDocument();
  });

  it("lists the plan mix and recent activity", async () => {
    renderWithProviders(<AdminDashboard />);

    expect(await screen.findByText("free")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("user login")).toBeInTheDocument();
  });

  it("explains the failure instead of rendering an empty console", async () => {
    getStats.mockRejectedValue(new Error("boom"));
    renderWithProviders(<AdminDashboard />);

    expect(await screen.findByText(/could not load platform statistics/i)).toBeInTheDocument();
  });
});
