
import React from 'react';

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

// Instead of using JSX in a .ts file, use a string representation or import from the icons component
export const getProviderIcon = (providerType: string): React.FC<{ className?: string }> => {
  // Import icons from the provider-icons component which already has the SVGs defined
  switch (providerType) {
    case 'google-drive':
      return require('../components/icons/provider-icons').GoogleDriveIcon;
    case 'dropbox':
      return require('../components/icons/provider-icons').DropboxIcon;
    case 'onedrive':
      return require('../components/icons/provider-icons').OneDriveIcon;
    case 'box':
      return require('../components/icons/provider-icons').BoxIcon;
    case 'amazon-s3':
      return require('../components/icons/provider-icons').AmazonS3Icon;
    case 'backblaze':
      return require('../components/icons/provider-icons').BackblazeIcon;
    case 'mega':
      return require('../components/icons/provider-icons').MegaIcon;
    case 'pcloud':
      return require('../components/icons/provider-icons').PCloudIcon;
    case 'yandex-disk':
      return require('../components/icons/provider-icons').YandexDiskIcon;
    case 'icedrive':
      return require('../components/icons/provider-icons').IcedriveIcon;
    case 'sync':
      return require('../components/icons/provider-icons').SyncIcon;
    default:
      // Default icon for unknown provider types
      const DefaultIcon = require('../components/icons/provider-icons').BoxIcon;
      return DefaultIcon;
  }
};
