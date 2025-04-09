
import { supabase } from "@/integrations/supabase/client";
import { FileItem, FileShare, StorageProviderInfo } from "@/types/file";

export interface StorageProvider {
  id: string;
  user_id: string;
  provider_name: 'google-drive' | 'dropbox' | 'onedrive' | 'box' | 'amazon-s3' | 'backblaze' | 'mega' | 'pcloud' | 'yandex-disk' | 'icedrive' | 'sync';
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  total_space: number | null;
  used_space: number | null;
  priority: number;
  status: 'connected' | 'disconnected' | 'error';
  provider_user_email: string | null;
  created_at: string;
  updated_at: string;
}

export const getStorageProviders = async (): Promise<StorageProvider[]> => {
  const { data, error } = await supabase
    .from('storage_providers')
    .select('*')
    .order('priority', { ascending: true });

  if (error) {
    console.error('Error fetching storage providers:', error);
    throw error;
  }

  return data as StorageProvider[] || [];
};

export const connectProvider = async (
  providerName: StorageProvider['provider_name'],
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
  userEmail: string,
  totalSpace: number
): Promise<StorageProvider> => {
  // Get user ID from the session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('User not authenticated');
  }

  // Get the count of existing providers to determine priority
  const { count, error: countError } = await supabase
    .from('storage_providers')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting providers:', countError);
    throw countError;
  }

  const priority = (count || 0) + 1;

  const { data, error } = await supabase
    .from('storage_providers')
    .insert({
      provider_name: providerName,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: expiresAt,
      total_space: totalSpace,
      used_space: 0,
      priority,
      status: 'connected',
      provider_user_email: userEmail,
      user_id: userData.user.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error connecting provider:', error);
    throw error;
  }

  return data as StorageProvider;
};

export const disconnectProvider = async (providerId: string): Promise<void> => {
  const { error } = await supabase
    .from('storage_providers')
    .update({ status: 'disconnected' })
    .eq('id', providerId);

  if (error) {
    console.error('Error disconnecting provider:', error);
    throw error;
  }
};

export const updateProviderPriority = async (providerId: string, newPriority: number): Promise<void> => {
  const { error } = await supabase
    .from('storage_providers')
    .update({ priority: newPriority })
    .eq('id', providerId);

  if (error) {
    console.error('Error updating provider priority:', error);
    throw error;
  }
};

export const getFiles = async (
  parentFolderId: string | null = null,
  sortBy: 'name' | 'date' | 'size' = 'date',
  sortDirection: 'asc' | 'desc' = 'desc'
): Promise<FileItem[]> => {
  let query = supabase
    .from('files')
    .select('*');

  if (parentFolderId) {
    query = query.eq('parent_folder_id', parentFolderId);
  } else {
    query = query.is('parent_folder_id', null);
  }

  if (sortBy === 'name') {
    query = query.order('filename', { ascending: sortDirection === 'asc' });
  } else if (sortBy === 'date') {
    query = query.order('updated_at', { ascending: sortDirection === 'asc' });
  } else if (sortBy === 'size') {
    query = query.order('size', { ascending: sortDirection === 'asc' });
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching files:', error);
    throw error;
  }

  return data || [];
};

export const getRecentFiles = async (
  limit: number = 10,
  period: 'today' | 'yesterday' | 'week' | 'month' = 'week'
): Promise<FileItem[]> => {
  const now = new Date();
  let startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'yesterday':
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      const endOfYesterday = new Date(startDate);
      endOfYesterday.setHours(23, 59, 59, 999);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
  }

  const { data, error } = await supabase
    .from('files')
    .select('*')
    .gte('last_accessed_at', startDate.toISOString())
    .order('last_accessed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent files:', error);
    throw error;
  }

  return data || [];
};

export const getStarredFiles = async (): Promise<FileItem[]> => {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('is_starred', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching starred files:', error);
    throw error;
  }

  return data || [];
};

export const getSharedFiles = async (): Promise<FileItem[]> => {
  const { data, error } = await supabase
    .from('files')
    .select('*')
    .eq('is_shared', true)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching shared files:', error);
    throw error;
  }

  return data || [];
};

export const createFolder = async (
  folderName: string,
  parentFolderId: string | null = null
): Promise<FileItem> => {
  // Get user ID from the session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('User not authenticated');
  }

  // Determine the path
  let path = `/${folderName}`;
  
  if (parentFolderId) {
    const { data: parentFolder, error: parentError } = await supabase
      .from('files')
      .select('path')
      .eq('id', parentFolderId)
      .single();

    if (parentError) {
      console.error('Error fetching parent folder:', parentError);
      throw parentError;
    }

    path = `${parentFolder.path}/${folderName}`;
  }

  const { data, error } = await supabase
    .from('files')
    .insert({
      filename: folderName,
      size: 0,
      path,
      parent_folder_id: parentFolderId,
      is_folder: true,
      user_id: userData.user.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    throw error;
  }

  return data;
};

export const uploadFile = async (
  file: File,
  parentFolderId: string | null = null,
  providerId: string | null = null
): Promise<FileItem> => {
  // Get user ID from the session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('User not authenticated');
  }

  // Determine the path
  let path = `/${file.name}`;
  
  if (parentFolderId) {
    const { data: parentFolder, error: parentError } = await supabase
      .from('files')
      .select('path')
      .eq('id', parentFolderId)
      .single();

    if (parentError) {
      console.error('Error fetching parent folder:', parentError);
      throw parentError;
    }

    path = `${parentFolder.path}/${file.name}`;
  }

  // First, upload the file to Supabase Storage
  const filePath = `${userData.user.id}/${Date.now()}_${file.name}`;
  
  const { data: storageData, error: storageError } = await supabase
    .storage
    .from('user_uploads')
    .upload(filePath, file);

  if (storageError) {
    console.error('Error uploading file to storage:', storageError);
    throw storageError;
  }

  // Then create the file record in the database
  const { data, error } = await supabase
    .from('files')
    .insert({
      filename: file.name,
      size: file.size,
      mime_type: file.type,
      path,
      parent_folder_id: parentFolderId,
      provider_id: providerId,
      provider_file_id: storageData.path,
      user_id: userData.user.id
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating file record:', error);
    throw error;
  }

  return data;
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('provider_file_id, is_folder')
    .eq('id', fileId)
    .single();

  if (fetchError) {
    console.error('Error fetching file:', fetchError);
    throw fetchError;
  }

  // If it's a folder, we need to recursively delete all files in it
  if (file.is_folder) {
    const { data: children, error: childrenError } = await supabase
      .from('files')
      .select('id')
      .eq('parent_folder_id', fileId);

    if (childrenError) {
      console.error('Error fetching folder children:', childrenError);
      throw childrenError;
    }

    // Recursively delete all children
    for (const child of children || []) {
      await deleteFile(child.id);
    }
  } else if (file.provider_file_id) {
    // Delete from storage if it's a file and stored in our system
    const { error: storageError } = await supabase
      .storage
      .from('user_uploads')
      .remove([file.provider_file_id]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue to delete the database record even if storage deletion fails
    }
  }

  // Delete the database record
  const { error } = await supabase
    .from('files')
    .delete()
    .eq('id', fileId);

  if (error) {
    console.error('Error deleting file record:', error);
    throw error;
  }
};

export const starFile = async (fileId: string, isStarred: boolean): Promise<void> => {
  const { error } = await supabase
    .from('files')
    .update({ is_starred: isStarred })
    .eq('id', fileId);

  if (error) {
    console.error('Error starring file:', error);
    throw error;
  }
};

export const renameFile = async (fileId: string, newName: string): Promise<void> => {
  const { data: file, error: fetchError } = await supabase
    .from('files')
    .select('path, filename')
    .eq('id', fileId)
    .single();

  if (fetchError) {
    console.error('Error fetching file:', fetchError);
    throw fetchError;
  }

  // Update the path
  const oldPath = file.path;
  const pathParts = oldPath.split('/');
  pathParts[pathParts.length - 1] = newName;
  const newPath = pathParts.join('/');

  const { error } = await supabase
    .from('files')
    .update({ 
      filename: newName,
      path: newPath
    })
    .eq('id', fileId);

  if (error) {
    console.error('Error renaming file:', error);
    throw error;
  }
};

export const shareFile = async (
  fileId: string,
  sharedWithEmail: string,
  permissionLevel: 'view' | 'edit' | 'admin' = 'view',
  expiresAt: string | null = null
): Promise<FileShare> => {
  // Get user ID from the session
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('User not authenticated');
  }

  // First, update the file to mark it as shared
  const { error: fileUpdateError } = await supabase
    .from('files')
    .update({ is_shared: true })
    .eq('id', fileId);

  if (fileUpdateError) {
    console.error('Error updating file share status:', fileUpdateError);
    throw fileUpdateError;
  }

  // Then create the share record
  const { data, error } = await supabase
    .from('file_shares')
    .insert({
      file_id: fileId,
      owner_id: userData.user.id,
      shared_with_email: sharedWithEmail,
      permission_level: permissionLevel,
      expires_at: expiresAt
    })
    .select()
    .single();

  if (error) {
    console.error('Error sharing file:', error);
    throw error;
  }

  return data as FileShare;
};

export const getFileSharesForFile = async (fileId: string): Promise<FileShare[]> => {
  const { data, error } = await supabase
    .from('file_shares')
    .select('*')
    .eq('file_id', fileId);

  if (error) {
    console.error('Error fetching file shares:', error);
    throw error;
  }

  return data as FileShare[] || [];
};

export const removeFileShare = async (shareId: string): Promise<void> => {
  const { error } = await supabase
    .from('file_shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    console.error('Error removing file share:', error);
    throw error;
  }
};

export const getStorageUsage = async (): Promise<{
  totalSpace: number;
  usedSpace: number;
  providers: {
    id: string;
    name: string;
    totalSpace: number;
    usedSpace: number;
    type: string;
  }[];
}> => {
  const { data, error } = await supabase
    .from('storage_providers')
    .select('*');

  if (error) {
    console.error('Error fetching storage usage:', error);
    throw error;
  }

  const providers = data.map(provider => ({
    id: provider.id,
    name: provider.provider_name,
    totalSpace: provider.total_space || 0,
    usedSpace: provider.used_space || 0,
    type: 'External'
  }));

  // Calculate total space and used space
  const totalSpace = providers.reduce((acc, provider) => acc + provider.totalSpace, 0);
  const usedSpace = providers.reduce((acc, provider) => acc + provider.usedSpace, 0);

  return {
    totalSpace,
    usedSpace,
    providers
  };
};
