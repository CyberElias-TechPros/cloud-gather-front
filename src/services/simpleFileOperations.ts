import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';
import { toast } from 'sonner';

interface SimpleFileOperationResult<T> {
  data?: T;
  error?: Error;
}

class SimpleFileOperations {
  /**
   * List files with basic error handling
   */
  async listFiles(
    parentFolderId: string | null = null,
    providerId: string | null = null,
    sortBy: 'name' | 'date' | 'size' = 'date',
    sortDirection: 'asc' | 'desc' = 'desc'
  ): Promise<SimpleFileOperationResult<FileItem[]>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      if (providerId) {
        // For now, return empty array for external providers
        return { data: [] };
      } else {
        // Fetch from database
        let query = supabase
          .from('files')
          .select('*');

        if (parentFolderId) {
          query = query.eq('parent_folder_id', parentFolderId);
        } else {
          query = query.is('parent_folder_id', null);
        }

        // Add sorting
        const orderColumn = sortBy === 'name' ? 'filename' : 
                           sortBy === 'date' ? 'updated_at' : 'size';
        query = query.order(orderColumn, { ascending: sortDirection === 'asc' });

        const { data, error } = await query;
        if (error) throw new Error(`Database error: ${error.message}`);

        return { data: data || [] };
      }
    } catch (error) {
      console.error('Error loading files:', error);
      return { error: error as Error };
    }
  }

  /**
   * Create folder with basic validation
   */
  async createFolder(
    name: string, 
    parentFolderId: string | null = null
  ): Promise<SimpleFileOperationResult<FileItem>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      if (!name || !name.trim()) {
        throw new Error('Folder name is required');
      }

      // Determine path
      let path = `/${name.trim()}`;
      if (parentFolderId) {
        // For simplicity, just use the folder name as path
        path = `/${name.trim()}`;
      }

      // Create folder
      const { data, error } = await supabase
        .from('files')
        .insert({
          filename: name.trim(),
          path,
          is_folder: true,
          parent_folder_id: parentFolderId,
          size: 0,
          user_id: session.session.user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('A folder with this name already exists');
        }
        throw new Error(`Failed to create folder: ${error.message}`);
      }

      return { data };
    } catch (error) {
      console.error('Error creating folder:', error);
      return { error: error as Error };
    }
  }

  /**
   * Upload file with basic functionality
   */
  async uploadFile(
    file: File,
    parentFolderId: string | null = null,
    providerId: string | null = null,
    onProgress?: (progress: { fileId: string; fileName: string; progress: number }) => void
  ): Promise<SimpleFileOperationResult<FileItem>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      // Basic file validation
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File too large (max 100MB)');
      }

      // Simulate progress
      const progressData = {
        fileId: `upload_${Date.now()}`,
        fileName: file.name,
        progress: 0,
      };

      onProgress?.(progressData);

      // Upload to storage
      const storageFilePath = `${session.session.user.id}/${Date.now()}_${file.name}`;
      
      progressData.progress = 50;
      onProgress?.(progressData);

      const { data: storageData, error: storageError } = await supabase.storage
        .from('user_uploads')
        .upload(storageFilePath, file);

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      progressData.progress = 80;
      onProgress?.(progressData);

      // Create database record
      const filePath = parentFolderId ? `/${file.name}` : `/${file.name}`;
      
      const { data, error } = await supabase
        .from('files')
        .insert({
          filename: file.name,
          size: file.size,
          mime_type: file.type,
          path: filePath,
          parent_folder_id: parentFolderId,
          provider_id: providerId,
          provider_file_id: storageFilePath,
          user_id: session.session.user.id,
        })
        .select()
        .single();

      if (error) {
        // Cleanup storage if database insert fails
        await supabase.storage.from('user_uploads').remove([storageFilePath]);
        throw new Error(`Database error: ${error.message}`);
      }

      progressData.progress = 100;
      onProgress?.(progressData);

      return { data };
    } catch (error) {
      console.error('Error uploading file:', error);
      return { error: error as Error };
    }
  }

  /**
   * Delete file or folder
   */
  async deleteFile(file: FileItem): Promise<SimpleFileOperationResult<void>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      // Delete from storage if it exists
      if (file.provider_file_id && !file.provider_id) {
        await supabase.storage
          .from('user_uploads')
          .remove([file.provider_file_id]);
      }

      // Delete database record
      const { error } = await supabase
        .from('files')
        .delete()
        .eq('id', file.id)
        .eq('user_id', session.session.user.id);

      if (error) {
        throw new Error(`Failed to delete: ${error.message}`);
      }

      return { data: undefined };
    } catch (error) {
      console.error('Error deleting file:', error);
      return { error: error as Error };
    }
  }

  /**
   * Get file content for download
   */
  async getFileContent(fileId: string): Promise<SimpleFileOperationResult<{ content: Blob; mimeType: string }>> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      // Get file info
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', session.session.user.id)
        .single();

      if (fileError || !file) {
        throw new Error('File not found');
      }

      if (file.is_folder) {
        throw new Error('Cannot download folder');
      }

      if (!file.provider_file_id) {
        throw new Error('File content not available');
      }

      // Download from storage
      const { data, error } = await supabase.storage
        .from('user_uploads')
        .download(file.provider_file_id);

      if (error || !data) {
        throw new Error(`Failed to download: ${error?.message || 'Unknown error'}`);
      }

      return {
        data: {
          content: data,
          mimeType: file.mime_type || 'application/octet-stream',
        }
      };
    } catch (error) {
      console.error('Error getting file content:', error);
      return { error: error as Error };
    }
  }
}

export const simpleFileOperations = new SimpleFileOperations();