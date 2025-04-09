
export interface FileItem {
  id: string;
  filename: string;
  size: number;
  mime_type: string | null;
  path: string;
  is_folder: boolean;
  provider_id: string | null;
  provider_file_id: string | null;
  is_starred: boolean;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
  last_accessed_at: string | null;
  parent_folder_id: string | null;
  user_id: string;
  
  // UI-specific properties (computed)
  name?: string;      // Alias for filename for UI components
  type?: string;      // Computed from mime_type
  modified?: string;  // Formatted updated_at date
  provider?: string;  // Provider name from provider_id
  icon?: string;      // Icon based on file type
  url?: string;       // URL for file access
}

export interface SharedFileInfo {
  id: string;
  file_id: string;
  owner_id: string;
  shared_with_email: string | null;
  shared_with_id: string | null;
  permission_level: 'view' | 'edit' | 'admin';
  created_at: string;
  expires_at: string | null;
}

export interface StorageProviderInfo {
  id: string;
  name: string;
  type: 'google-drive' | 'dropbox' | 'onedrive' | 'box' | 'amazon-s3' | 'backblaze' | 'mega' | 'pcloud' | 'yandex-disk' | 'icedrive' | 'sync' | 'add';
  totalSpace?: number;
  usedSpace?: number;
  status?: 'connected' | 'disconnected' | 'error';
  priority?: number;
  icon?: string;
  freeStorageSize?: string;
  description?: string;
  authUrl?: string;
}

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  status: 'uploading' | 'success' | 'error' | 'canceled';
  error?: string;
  fileType?: string;
}
