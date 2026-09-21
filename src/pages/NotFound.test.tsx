import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFound from "./NotFound";
import { AuthProvider } from "@/contexts/AuthContext";

describe("NotFound", () => {
  beforeEach(() => localStorage.clear());
  it("explains that the route does not exist", () => {
    render(<MemoryRouter><AuthProvider><NotFound /></AuthProvider></MemoryRouter>);
    expect(screen.getByRole("heading", { name: /page not found/i })).toBeInTheDocument();
  });
  it("offers a route home", () => {
    render(<MemoryRouter><AuthProvider><NotFound /></AuthProvider></MemoryRouter>);
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });
});
