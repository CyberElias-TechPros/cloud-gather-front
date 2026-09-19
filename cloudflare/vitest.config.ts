import { defineConfig } from "vitest/config";

/**
 * Unit tests for the Worker. These run in plain Node against pure modules —
 * the integration layer (D1/R2/KV/Queues) is covered by `npm run api:e2e`,
 * which runs against the real workerd runtime.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globals: false,
  },
});
