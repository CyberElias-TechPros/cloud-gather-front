import { defineConfig } from "vitest/config";

/**
 * Unit tests for the Worker. They cover the pure logic — crypto, validation,
 * routing, ZIP framing, SigV4 signing and the naming/quota rules — while the
 * full request lifecycle is exercised by `npm run api:smoke` against a real
 * Miniflare runtime (D1, R2, KV and Queues are the real thing there).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["cloudflare/tests/unit/**/*.test.ts"],
    globals: false,
  },
});
