/** Formatting helpers shared across the app. */

/**
 * Parses the timestamp formats the API returns. D1 columns that default to
 * CURRENT_TIMESTAMP come back as "YYYY-MM-DD HH:MM:SS" (UTC, no zone marker),
 * while values written by the Worker are full ISO-8601 strings. Treat the
 * former as UTC so the browser does not shift them by the local offset.
 */
export function parseDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const value = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(input) ? `${input.replace(" ", "T")}Z` : input;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format a byte count as a human-readable string (KB, MB, GB…). */
export function formatBytes(bytes: number | null | undefined, decimals = 1): string {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)), sizes.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${parseFloat(value.toFixed(Math.max(0, decimals)))} ${sizes[i]}`;
}

/** Format a percentage of used/total, guarding against divide-by-zero. */
export function formatPercent(used: number, total: number): string {
  if (!total || total <= 0) return "0%";
  return `${Math.min(100, Math.round((used / total) * 100))}%`;
}

/** ISO date or Date → "Mar 8, 2026". */
export function formatDate(input: string | Date | null | undefined): string {
  const date = parseDate(input);
  if (!date) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** ISO date → "Mar 8, 2026, 4:05 PM". */
export function formatDateTime(input: string | Date | null | undefined): string {
  const date = parseDate(input);
  if (!date) return "—";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative time ("3 min ago", "2 days ago"). Falls back to a date beyond a month. */
export function formatRelativeTime(input: string | Date | null | undefined): string {
  const date = parseDate(input);
  if (!date) return "—";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.floor(seconds / 3600);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(seconds / 86400);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

  const weeks = Math.floor(days / 7);
  if (weeks <= 4) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;

  return formatDate(date);
}

/** True when the mime type (or filename) refers to an image the browser can show. */
export function isPreviewableImage(mimeType?: string | null, filename?: string): boolean {
  if (mimeType && mimeType.startsWith("image/") && !mimeType.includes("svg")) return true;
  if (!mimeType && filename) {
    return /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(filename);
  }
  return false;
}
