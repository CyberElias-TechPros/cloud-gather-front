/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    // Bind on all interfaces so the dev server is reachable from containers/proxies.
    host: "::",
    port: 8080,
    // Same-origin API in development: the browser calls the relative `/api`
    // path (see src/lib/api.ts) and Vite forwards it to the Worker, so no CORS
    // or hardcoded localhost URL is needed. Point WORKER_ORIGIN elsewhere to
    // develop against a deployed Worker.
    proxy: {
      "/api": {
        target: process.env.WORKER_ORIGIN || "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
    // Behind an HTTPS proxy the HMR socket must be told which port to dial.
    hmr: process.env.HMR_CLIENT_PORT
      ? { clientPort: Number(process.env.HMR_CLIENT_PORT), protocol: "wss" }
      : undefined,
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          "ui-vendor": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-select",
            "lucide-react",
          ],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: false,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    env: {
      VITE_API_URL: "http://localhost:8787/api",
      VITE_PUBLIC_SITE_URL: "http://localhost:8080",
    },
  },
}));
