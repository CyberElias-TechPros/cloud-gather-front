import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure DOM state (and the <head> mutations made by the Seo component)
// don't leak between tests.
afterEach(() => {
  cleanup();
  document.head.innerHTML = "";
  document.title = "";
});
