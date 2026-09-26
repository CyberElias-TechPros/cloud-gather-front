/**
 * Core domain types for files, shares and providers.
 * Provider presentation metadata lives in `src/lib/providers.tsx`.
 */

export interface FileItem {
  id: string;
  filename: string;
  path: string;
  size: number;
  mime_type?: string | null;
  is_folder?: boolean | null;
  provider_id?: string | null;
  provider_file_id?: string | null;
  provider_name?: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string | null;
  is_starred?: boolean | null;
  is_shared?: boolean | null;
  parent_folder_id?: string | null;
  user_id: string;

  /* Added by the platform API */
  storage_kind?: "managed" | "provider";
  version?: number;
  category?: string | null;
  tags?: string[];
  description?: string | null;
  download_count?: number;
  web_url?: string | null;
  deleted_at?: string | null;
  purge_at?: string | null;
}

export interface FileShare {
  id: string;
  file_id: string;
  owner_id: string;
  shared_with_id?: string | null;
  shared_with_email?: string | null;
  permission_level: "view" | "edit" | "admin";
  created_at: string;
  expires_at?: string | null;
}

export type ProviderConnectionStatus = "connected" | "disconnected" | "error" | "syncing";

export interface StorageProviderInfo {
  id: string;
  name: string;
  providerId: string;
  status?: ProviderConnectionStatus;
  totalSpace?: number | null;
  usedSpace?: number | null;
  priority?: number;
  accountEmail?: string | null;
}
