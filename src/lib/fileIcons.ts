import type React from "react";

import {
  Archive,
  File as FileIcon,
  FileCode,
  FileSpreadsheet,
  FileText,
  Folder,
  Image,
  Music,
  Presentation,
  Video,
} from "lucide-react";
import type { FileItem } from "@/types/file";

export type IconComponent = React.ComponentType<{ className?: string }>;

const EXTENSION_KINDS: Record<string, string> = {
  pdf: "document",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  txt: "document",
  md: "document",
  csv: "spreadsheet",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ods: "spreadsheet",
  ppt: "presentation",
  pptx: "presentation",
  key: "presentation",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  tar: "archive",
  gz: "archive",
  bz2: "archive",
  js: "code",
  ts: "code",
  tsx: "code",
  jsx: "code",
  json: "code",
  py: "code",
  rb: "code",
  go: "code",
  rs: "code",
  java: "code",
  sh: "code",
  yml: "code",
  yaml: "code",
  html: "code",
  css: "code",
  sql: "code",
};

/** Broad content category used for icons, filters and storage breakdowns. */
export function fileKind(file: Pick<FileItem, "mime_type" | "filename" | "is_folder">): string {
  if (file.is_folder) return "folder";
  const mime = (file.mime_type ?? "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("opendocument.text")) return "document";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) return "spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "presentation";
  if (mime.includes("zip") || mime.includes("compressed") || mime.includes("tar") || mime.includes("rar")) return "archive";
  if (mime.startsWith("text/")) return "document";

  const extension = (file.filename ?? "").split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_KINDS[extension] ?? "other";
}

const KIND_ICONS: Record<string, IconComponent> = {
  folder: Folder,
  image: Image,
  video: Video,
  audio: Music,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  archive: Archive,
  code: FileCode,
  other: FileIcon,
};

/** Lucide icon component matching a file's kind. */
export function fileIconFor(file: Pick<FileItem, "mime_type" | "filename" | "is_folder">): IconComponent {
  return KIND_ICONS[fileKind(file)] ?? FileIcon;
}

/** Icon for a category string returned by the API (`category` column). */
export function categoryIcon(category: string | null | undefined): IconComponent {
  return KIND_ICONS[(category ?? "other").toLowerCase()] ?? FileIcon;
}

export const KIND_LABELS: Record<string, string> = {
  folder: "Folders",
  image: "Images",
  video: "Video",
  audio: "Audio",
  document: "Documents",
  spreadsheet: "Spreadsheets",
  presentation: "Presentations",
  archive: "Archives",
  code: "Code",
  other: "Other",
};
