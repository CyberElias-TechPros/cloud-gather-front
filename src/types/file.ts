
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

// Define utility functions for provider types
export const getProviderDisplayName = (providerName: string): string => {
  const nameMap: Record<string, string> = {
    'google-drive': 'Google Drive',
    'dropbox': 'Dropbox',
    'onedrive': 'OneDrive',
    'box': 'Box',
    'amazon-s3': 'Amazon S3',
    'backblaze': 'Backblaze B2',
    'mega': 'MEGA',
    'pcloud': 'pCloud',
    'yandex-disk': 'Yandex Disk',
    'icedrive': 'Icedrive',
    'sync': 'Sync.com',
    'add': 'Add Provider'
  };
  
  return nameMap[providerName] || providerName.charAt(0).toUpperCase() + providerName.slice(1);
};

export const getProviderIcon = (providerType: string): React.FC<{ className?: string }> => {
  switch (providerType) {
    case 'google-drive':
      return ({ className }) => <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M4.433 22h15.135c.32 0 .595-.225.675-.53l2.175-9.65a.68.68 0 0 0-.12-.585.645.645 0 0 0-.555-.235H8.097l-2.38-4.7a.69.69 0 0 0-.62-.38H.758a.688.688 0 0 0-.675.535.687.687 0 0 0 .148.68l4.716 6.53-1.64 7.285c-.08.36.148.72.5.84.09.02.188.03.282.03h.344v.18zM23.61 11.67l-3.038-5.488a.689.689 0 0 0-.614-.345h-5.646c-.364 0-.675.27-.675.63 0 .12.033.24.102.344l2.95 5.528h6.921v-.668zm-6.858 10.33h6.858c.32 0 .596-.225.676-.53l1.55-6.87h-6.32l-2.764 7.4z" fillRule="nonzero"/></svg>;
    case 'dropbox':
      return ({ className }) => <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M6 2l6 3.75L6 9.5 0 5.75 6 2zm12 0l6 3.75-6 3.75-6-3.75L18 2zM0 14.25L6 10.5l6 3.75L6 18l-6-3.75zm18 0l6-3.75v7.5L18 22l-6-3.75 6-4zm-6-5.5L18 5l6 3.75-6 3.75-6-3.75z" fillRule="nonzero"/></svg>;
    case 'onedrive':
      return ({ className }) => <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M10.5 12.5h-8s-1.875.625-1.875 1.875v5.625S.625 21.875 1.875 21.875h16.25s1.875-.625 1.875-1.875v-5.625S20 12.5 18.75 12.5h-8.125M1.875 11.875H9.5s.625-1.25 1.875-1.25h7.5S20 9.375 20 8.125v-5S20 1.25 18.125 1.25H5.625S3.75 1.25 3.75 3.125v7.5c0 .625-.625 1.25-1.875 1.25" fillRule="evenodd"/></svg>;
    default:
      return ({ className }) => <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2zm-7-2h7v-7h-7v7zm-2-7H5v7h5v-7zm0-2V5H5v5h5zm2 0h7V5h-7v5z"/></svg>;
  }
};
