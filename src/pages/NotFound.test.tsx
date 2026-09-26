import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import NotFound from "./NotFound";
import { renderWithProviders } from "@/test/utils";

describe("NotFound", () => {
  beforeEach(() => localStorage.clear());

  it("explains that the route does not exist", () => {
    renderWithProviders(<NotFound />, { route: "/does-not-exist" });
    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });

  it("offers a route home", () => {
    renderWithProviders(<NotFound />, { route: "/does-not-exist" });
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });
});
