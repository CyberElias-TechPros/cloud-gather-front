import { describe, expect, it, vi } from "vitest";
import type { Ctx } from "../src/core/context";
const stored = vi.hoisted(() => ({ run: vi.fn(async () => ({ meta: {} })) }));
vi.mock("../src/core/db", () => ({
  run: stored.run, all: vi.fn(), count: vi.fn(), first: vi.fn(), pageParams: vi.fn(), paged: vi.fn(),
}));
vi.mock("../src/core/audit", () => ({ audit: vi.fn(), systemAudit: vi.fn() }));
vi.mock("../src/core/email", () => ({
  deliver: vi.fn(async () => {}), sendEmail: vi.fn(async () => {}),
  templates: { contactAcknowledgement: () => ({}), contactNotification: () => ({}) },
}));
vi.mock("../src/core/notify", () => ({ notifyAdmins: vi.fn(async () => {}) }));
import { contactRoutes } from "../src/routes/contact";
function ctx(user: object | null): Ctx {
  return {
    user, env: { TURNSTILE_SECRET_KEY: "configured-secret" },
    request: new Request("https://api.example/api/contact/mine", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Forged Sender", email: "forged@example.com", subject: "Native support", message: "Please help with this upload." }),
    }), waitUntil: () => {},
  } as unknown as Ctx;
}
describe("native authenticated support", () => {
  it("requires authentication, verification policy and per-user throttling", () => {
    const route = contactRoutes.match("POST", "/api/contact/mine")!.route;
    expect(route.auth).toBe(true); expect(route.verified).toBe(true);
    expect(route.scope).toBe("write"); expect(route.rateLimit).toEqual({ limit: 5, windowSeconds: 3600, by: "user" });
  });
  it("binds support sender to the authenticated identity, not the request", async () => {
    stored.run.mockClear();
    const response = await contactRoutes.match("POST", "/api/contact/mine")!.route.handler(ctx({ id: "user-1", display_name: "Actual Sender", email: "real@example.com" }));
    expect(response.status).toBe(201);
    const insert = stored.run.mock.calls[0] as unknown[];
    expect(insert).toContain("user-1"); expect(insert).toContain("Actual Sender"); expect(insert).toContain("real@example.com");
    expect(insert).not.toContain("forged@example.com");
  });
  it("does not bypass CAPTCHA on the anonymous endpoint", async () => {
    await expect(contactRoutes.match("POST", "/api/contact")!.route.handler(ctx(null))).rejects.toThrow("Bot check failed");
  });
});
