import { describe, it, expect } from "vitest";
import { formatBytes, formatPercent, formatDate, formatDateTime, formatRelativeTime, isPreviewableImage } from "./format";

describe("formatBytes", () => {
  it("handles zero, null and invalid values", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(null)).toBe("—");
    expect(formatBytes(undefined)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });

  it("formats common sizes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1 MB");
    expect(formatBytes(5 * 1024 * 1024 * 1024)).toBe("5 GB");
  });

  it("formats very large values without producing Infinity units", () => {
    const pb = 1024 ** 6;
    expect(formatBytes(pb)).toMatch(/PB$/);
  });

  it("handles negative values without crashing", () => {
    expect(formatBytes(-2048)).toMatch(/KB$/);
  });
});

describe("formatPercent", () => {
  it("guards against divide-by-zero and overflow", () => {
    expect(formatPercent(10, 0)).toBe("0%");
    expect(formatPercent(50, 100)).toBe("50%");
    expect(formatPercent(150, 100)).toBe("100%");
  });
});

describe("formatDate / formatDateTime", () => {
  it("returns em-dash for missing or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });

  it("formats a known date", () => {
    // Use ISO with time to be timezone-stable enough for assertions on parts
    const formatted = formatDate(new Date("2026-03-08T12:00:00Z"));
    expect(formatted).toMatch(/2026/);
    expect(formatted).toMatch(/Mar/);
  });
});

describe("formatRelativeTime", () => {
  it("reports just-now for very recent timestamps", () => {
    expect(formatRelativeTime(new Date(Date.now() - 5000))).toBe("just now");
  });

  it("reports minutes and hours", () => {
    expect(formatRelativeTime(new Date(Date.now() - 5 * 60 * 1000))).toBe("5 mins ago");
    expect(formatRelativeTime(new Date(Date.now() - 3600 * 1000))).toBe("1 hour ago");
  });

  it("falls back to an absolute date far in the past", () => {
    expect(formatRelativeTime(new Date(Date.now() - 400 * 86400000))).toMatch(/20\d\d/);
  });

  it("handles invalid input", () => {
    expect(formatRelativeTime("garbage")).toBe("—");
  });
});

describe("isPreviewableImage", () => {
  it("accepts raster image mime types", () => {
    expect(isPreviewableImage("image/png")).toBe(true);
    expect(isPreviewableImage("image/jpeg")).toBe(true);
  });

  it("rejects svg (safe-rendering policy) and non-images", () => {
    expect(isPreviewableImage("image/svg+xml")).toBe(false);
    expect(isPreviewableImage("application/pdf")).toBe(false);
  });

  it("falls back to the filename extension when mime is missing", () => {
    expect(isPreviewableImage(null, "photo.JPG")).toBe(true);
    expect(isPreviewableImage(null, "vector.svg")).toBe(false);
    expect(isPreviewableImage(null, "doc.pdf")).toBe(false);
  });
});
