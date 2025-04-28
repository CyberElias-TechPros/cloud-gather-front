
export interface FileItem {
  id: string;
  filename: string;
  path: string;
  size: number;
  mime_type?: string | null;
  is_folder?: boolean | null;
  provider_id?: string | null;
  provider_file_id?: string | null;
  created_at: string;
  updated_at: string;
  last_accessed_at?: string | null;
  is_starred?: boolean | null;
  is_shared?: boolean | null;
  parent_folder_id?: string | null;
  user_id: string;
  // Add these properties for compatibility with components
  isFolder?: boolean;
  type?: string;
  modified?: string;
  provider?: string;
}

export interface FileShare {
  id: string;
  file_id: string;
  owner_id: string;
  shared_with_id?: string | null;
  shared_with_email?: string | null;
  permission_level: 'view' | 'edit' | 'admin';
  created_at: string;
  expires_at?: string | null;
}

export interface StorageProviderInfo {
  id: string;
  name: string;
  type: 'google-drive' | 'dropbox' | 'onedrive' | 'box' | 'amazon-s3' | 'backblaze' | 'mega' | 'pcloud' | 'yandex-disk' | 'icedrive' | 'sync' | 'add';
  description?: string;
  status?: 'connected' | 'disconnected' | 'error';
  totalSpace?: number;
  usedSpace?: number;
  freeStorageSize?: string;
  icon?: string;
  priority?: number;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  user_id: string;
  permissions: string[];
  created_at: string;
  last_used_at?: string | null;
  expires_at?: string | null;
  status: 'active' | 'expired' | 'revoked';
}
