/** Small shared primitives used across the API. */

export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const iso = (date: Date) => date.toISOString();
export const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
export const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function toInt(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** SQL LIKE escaping so user input can never inject wildcards. */
export const likeEscape = (value: string) => value.replace(/[\\%_]/g, "\\$&");

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

/** Splits `name.ext` so conflicting uploads can become `name (2).ext`. */
export function splitExtension(filename: string): { base: string; ext: string } {
  const index = filename.lastIndexOf(".");
  if (index <= 0) return { base: filename, ext: "" };
  return { base: filename.slice(0, index), ext: filename.slice(index) };
}

export const unique = <T>(values: T[]): T[] => [...new Set(values)];

export function chunk<T>(values: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

/** Runs promises with bounded concurrency — D1/R2 dislike unbounded fan-out. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export const isEmail = (value: unknown): value is string =>
  typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) && value.length <= 254;

export const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();

/** Guess a content type when a client sends none. */
export function guessMimeType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    svg: "image/svg+xml", avif: "image/avif", heic: "image/heic", bmp: "image/bmp", ico: "image/x-icon",
    pdf: "application/pdf", txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
    xml: "application/xml", html: "text/html", css: "text/css", js: "text/javascript", ts: "text/plain",
    zip: "application/zip", gz: "application/gzip", tar: "application/x-tar", rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac",
    mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo",
    doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] || "application/octet-stream";
}

/** Coarse file category used by filters and analytics. */
export function fileCategory(mime: string | null | undefined, isFolder = false): string {
  if (isFolder) return "folder";
  const value = (mime || "").toLowerCase();
  if (value.startsWith("image/")) return "image";
  if (value.startsWith("video/")) return "video";
  if (value.startsWith("audio/")) return "audio";
  if (value === "application/pdf" || value.includes("word") || value.includes("document") || value.startsWith("text/")) return "document";
  if (value.includes("sheet") || value.includes("excel") || value === "text/csv") return "spreadsheet";
  if (value.includes("presentation") || value.includes("powerpoint")) return "presentation";
  if (value.includes("zip") || value.includes("compressed") || value.includes("tar") || value.includes("gzip")) return "archive";
  if (value.includes("json") || value.includes("javascript") || value.includes("xml")) return "code";
  return "other";
}
