import { describe, it, expect } from "vitest";
import { siteConfig, mainNav, footerNav } from "./site";

describe("site config", () => {
  it("normalizes the site URL (no trailing slash)", () => {
    expect(siteConfig.url.endsWith("/")).toBe(false);
  });

  it("uses the CloudGather brand consistently", () => {
    expect(siteConfig.name).toBe("CloudGather");
    expect(siteConfig.description.length).toBeGreaterThan(50);
  });
});

describe("navigation", () => {
  it("only links to routes that exist in the router", () => {
    // This guards against dead links if routes change.
    const validRoutes = [
      "/",
      "/features",
      "/pricing",
      "/developers",
      "/blog",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
      "/login",
      "/register",
      "/reset-password",
    ];
    const allLinks = [
      ...mainNav.map((n) => n.href),
      ...footerNav.flatMap((g) => g.links.map((l) => l.href)),
    ].map((href) => href.split("#")[0]);
    for (const href of allLinks) {
      expect(validRoutes).toContain(href);
    }
  });

  it("has no duplicate footer link labels per group", () => {
    for (const group of footerNav) {
      const titles = group.links.map((l) => l.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});
