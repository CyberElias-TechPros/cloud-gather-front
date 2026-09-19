/**
 * API contract types — mirrors the Cloudflare Worker responses in
 * `cloudflare/src/routes/*`. Keeping them in one place is what stops the
 * frontend and backend drifting apart.
 */

export type FileKind =
  | "folder"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "spreadsheet"
  | "presentation"
  | "archive"
  | "code"
  | "text"
  | "other";

export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string | null;
  isFolder: boolean;
  parentId: string | null;
  providerId: string | null;
  providerFileId: string | null;
  hosted: boolean;
  isStarred: boolean;
  trashedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  shareCount: number;
  kind: FileKind;
}

export interface BreadcrumbEntry {
  id: string;
  name: string;
  path: string;
}

export interface FileListResponse {
  files: FileItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  breadcrumb: BreadcrumbEntry[];
  quotaBytes: number;
}

export type SortField = "name" | "date" | "size" | "type";
export type SortDirection = "asc" | "desc";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  status: "active" | "suspended";
  emailVerified: boolean;
  storageQuotaBytes: number | null;
  settings: Record<string, string>;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export interface StorageSummary {
  usedBytes: number;
  quotaBytes: number;
  indexedBytes: number;
  trashedBytes: number;
  fileCount: number;
  folderCount: number;
  trashCount: number;
  byKind: Array<{ kind: FileKind; bytes: number; count: number }>;
}

export interface ProviderConnection {
  id: string;
  providerName: string;
  authType: "managed" | "oauth" | "credentials";
  status: "connected" | "disconnected" | "error";
  accountEmail: string | null;
  accountLabel: string | null;
  tokenExpiresAt: string | null;
  totalSpace: number | null;
  usedSpace: number | null;
  priority: number;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  fileCount: number;
  indexedBytes: number;
  remoteBrowsing: boolean;
}

export interface ProviderCatalogEntry {
  name: string;
  displayName: string;
  authType: "managed" | "oauth" | "credentials";
  configured: boolean;
  connected: boolean;
  remoteBrowsing: boolean;
}

export interface RemoteEntry {
  id: string;
  name: string;
  size: number;
  isFolder: boolean;
  mimeType: string | null;
  updatedAt: string | null;
  kind?: FileKind;
}

export interface ShareRecord {
  id: string;
  fileId: string;
  fileName?: string;
  name?: string;
  fileSize?: number;
  kind: "email" | "link";
  recipientEmail: string | null;
  permission: "view" | "edit";
  url: string | null;
  hasPassword?: boolean;
  expiresAt: string | null;
  maxDownloads?: number | null;
  downloadCount?: number;
  viewCount?: number;
  lastAccessedAt?: string | null;
  createdAt: string;
  owner?: { email: string; name: string | null };
  isFolder?: boolean;
  path?: string;
}

export interface PublicShareResponse {
  share: {
    id: string;
    kind: "email" | "link";
    permission: "view" | "edit";
    hasPassword: boolean;
    unlocked: boolean;
    expiresAt: string | null;
    downloadCount: number;
    maxDownloads: number | null;
    ownerName: string;
  };
  file: FileItem;
  children: RemoteEntry[];
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt?: string | null;
  requestCount?: number;
  createdAt: string;
  status: "active" | "revoked" | "expired";
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ActivityEvent {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage?: string | null;
  tags: string[];
  author: string | null;
  readMinutes: number;
  publishedAt: string | null;
  updatedAt?: string;
  contentMd?: string;
}

export interface PlatformConfig {
  appName: string;
  appDescription: string;
  appVersion: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  maxFileSizeMb: number;
  defaultQuotaGb: number;
  trashRetentionDays: number;
  allowedFileTypes: string[];
  supportEmail: string;
  environment: string;
  emailDeliveryConfigured: boolean;
}

export interface AdminTotals {
  users: number;
  activeUsers: number;
  newUsersThisWeek: number;
  files: number;
  storedBytes: number;
  providers: number;
  connectedProviders: number;
  shares: number;
  activeShares: number;
  apiKeys: number;
  activeApiKeys: number;
  bytesUploaded: number;
  bytesDownloaded: number;
  apiCalls: number;
}

export interface AdminOverview {
  totals: AdminTotals;
  usageByDay: Array<{ day: string; uploads: number; downloads: number; api_calls: number }>;
  recentUsers: Array<{ id: string; email: string; display_name: string | null; role: string; status: string; created_at: string; used_bytes: number }>;
  topUsers: Array<{ id: string; email: string; display_name: string | null; used_bytes: number; file_count: number }>;
  runtime: { environment: string; emailConfigured: boolean; encryptionConfigured: boolean };
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  status: string;
  email_verified: number;
  storage_quota_bytes: number | null;
  created_at: string;
  last_login_at: string | null;
  file_count: number;
  used_bytes: number;
  providers: number;
}

export interface AuditEvent {
  id: string;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface SettingRecord {
  key: string;
  value: unknown;
  description: string;
  updatedAt: string;
  type: string;
}
