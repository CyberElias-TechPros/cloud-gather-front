
import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';
import { 
  validateFileUpload, 
  validateFolderCreate, 
  validateFileShare 
} from '@/lib/validation/schemas';
import { errorHandler, ErrorCode, handleAsync } from '@/lib/error/ErrorHandler';
import { toast } from 'sonner';
import { RateLimiter } from '@/lib/security/rateLimiter';

// Create rate limiters for different operations
const uploadRateLimit = new RateLimiter(50, 60000); // 50 uploads per minute
const operationRateLimit = new RateLimiter(200, 60000); // 200 operations per minute

interface FileOperationResult<T> {
  data?: T;
  error?: Error;
}

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

class EnhancedFileOperations {
  private uploadProgressMap = new Map<string, UploadProgress>();
  private operationQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  /**
   * List files with comprehensive error handling and caching
   */
  async listFiles(
    parentFolderId: string | null = null,
    providerId: string | null = null,
    sortBy: 'name' | 'date' | 'size' = 'date',
    sortDirection: 'asc' | 'desc' = 'desc'
  ): Promise<FileOperationResult<FileItem[]>> {
    return handleAsync(async () => {
      const userId = await this.getCurrentUserId();
      const rateLimitResult = operationRateLimit.isAllowed(userId);
      
      if (!rateLimitResult.allowed) {
        throw new Error('Too many requests. Please wait a moment.');
      }

      if (providerId) {
        // Fetch from external provider
        const { data, error } = await supabase.functions.invoke('list-files', {
          body: { providerId, folderId: parentFolderId },
        });

        if (error) throw new Error(error.message);
        return data.files || [];
      } else {
        // Fetch from database with optimized query
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

        // Add pagination for large datasets
        query = query.limit(1000);

        const { data, error } = await query;
        if (error) throw new Error(`Database error: ${error.message}`);

        return data || [];
      }
    }, { operation: 'listFiles', parentFolderId, providerId });
  }

  /**
   * Create folder with validation and conflict detection
   */
  async createFolder(
    name: string, 
    parentFolderId: string | null = null
  ): Promise<FileOperationResult<FileItem>> {
    return handleAsync(async () => {
      // Validate input
      const validatedData = validateFolderCreate({ name, parentFolderId });
      
      const userId = await this.getCurrentUserId();
      const rateLimitResult = operationRateLimit.isAllowed(userId);
      
      if (!rateLimitResult.allowed) {
        throw new Error('Too many requests. Please wait a moment.');
      }

      // Check for naming conflicts
      await this.checkNamingConflict(validatedData.name, parentFolderId, userId);

      // Determine path
      let path = `/${validatedData.name}`;
      if (parentFolderId) {
        const parentPath = await this.getFilePathById(parentFolderId);
        path = `${parentPath}/${validatedData.name}`;
      }

      // Create folder
      const { data, error } = await supabase
        .from('files')
        .insert({
          filename: validatedData.name,
          path,
          is_folder: true,
          parent_folder_id: parentFolderId,
          size: 0,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error('A folder with this name already exists');
        }
        throw new Error(`Failed to create folder: ${error.message}`);
      }

      toast.success(`Folder "${validatedData.name}" created successfully`);
      return data;
    }, { operation: 'createFolder', name });
  }

  /**
   * Upload file with progress tracking and validation
   */
  async uploadFile(
    file: File,
    parentFolderId: string | null = null,
    providerId: string | null = null,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<FileOperationResult<FileItem>> {
    const fileId = `upload_${Date.now()}_${Math.random()}`;
    
    return handleAsync(async () => {
      // Validate file
      const validatedData = validateFileUpload({
        name: file.name,
        size: file.size,
        type: file.type,
        parentFolderId,
      });

      const userId = await this.getCurrentUserId();
      const rateLimitResult = uploadRateLimit.isAllowed(userId);
      
      if (!rateLimitResult.allowed) {
        throw new Error('Upload rate limit exceeded. Please wait before uploading more files.');
      }

      // Initialize progress tracking
      const progressData: UploadProgress = {
        fileId,
        fileName: file.name,
        progress: 0,
        status: 'pending',
      };
      this.uploadProgressMap.set(fileId, progressData);
      onProgress?.(progressData);

      try {
        // Check for naming conflicts
        await this.checkNamingConflict(file.name, parentFolderId, userId);

        // Update progress
        progressData.status = 'uploading';
        progressData.progress = 10;
        this.uploadProgressMap.set(fileId, progressData);
        onProgress?.(progressData);

        // Determine file path
        let filePath = `/${file.name}`;
        if (parentFolderId) {
          const parentPath = await this.getFilePathById(parentFolderId);
          filePath = `${parentPath}/${file.name}`;
        }

        // Upload to storage
        const storageFilePath = `${userId}/${Date.now()}_${file.name}`;
        
        progressData.progress = 30;
        this.uploadProgressMap.set(fileId, progressData);
        onProgress?.(progressData);

        const { data: storageData, error: storageError } = await supabase.storage
          .from('user_uploads')
          .upload(storageFilePath, file, {
            cacheControl: '3600',
          });

        if (storageError) {
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }

        progressData.progress = 80;
        this.uploadProgressMap.set(fileId, progressData);
        onProgress?.(progressData);

        // Create database record
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
            user_id: userId,
          })
          .select()
          .single();

        if (error) {
          // Cleanup storage if database insert fails
          await supabase.storage.from('user_uploads').remove([storageFilePath]);
          throw new Error(`Database error: ${error.message}`);
        }

        // Complete progress
        progressData.status = 'completed';
        progressData.progress = 100;
        this.uploadProgressMap.set(fileId, progressData);
        onProgress?.(progressData);

        toast.success(`File "${file.name}" uploaded successfully`);
        return data;

      } catch (error) {
        progressData.status = 'error';
        progressData.error = (error as Error).message;
        this.uploadProgressMap.set(fileId, progressData);
        onProgress?.(progressData);
        throw error;
      } finally {
        // Clean up progress data after 30 seconds
        setTimeout(() => {
          this.uploadProgressMap.delete(fileId);
        }, 30000);
      }
    }, { operation: 'uploadFile', fileName: file.name });
  }

  /**
   * Delete file or folder with cascade handling
   */
  async deleteFile(file: FileItem): Promise<FileOperationResult<void>> {
    return handleAsync(async () => {
      const userId = await this.getCurrentUserId();
      const rateLimitResult = operationRateLimit.isAllowed(userId);
      
      if (!rateLimitResult.allowed) {
        throw new Error('Too many requests. Please wait a moment.');
      }

      if (file.is_folder) {
        // Handle folder deletion recursively
        await this.deleteFolderRecursively(file.id, userId);
      } else {
        // Handle file deletion
        await this.deleteFileRecord(file, userId);
      }

      toast.success(`"${file.filename}" deleted successfully`);
    }, { operation: 'deleteFile', fileId: file.id, fileName: file.filename });
  }

  /**
   * Share file with validation and permission checks
   */
  async shareFile(
    fileId: string,
    email: string,
    permissionLevel: 'view' | 'edit' | 'admin' = 'view',
    expiresAt: string | null = null
  ): Promise<FileOperationResult<void>> {
    return handleAsync(async () => {
      // Validate input
      const validatedData = validateFileShare({
        fileId,
        email,
        permissionLevel,
        expiresAt,
      });

      const userId = await this.getCurrentUserId();
      const rateLimitResult = operationRateLimit.isAllowed(userId);
      
      if (!rateLimitResult.allowed) {
        throw new Error('Too many requests. Please wait a moment.');
      }

      // Verify file ownership
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .eq('user_id', userId)
        .single();

      if (fileError || !file) {
        throw new Error('File not found or access denied');
      }

      // Check if already shared with this email
      const { data: existingShare } = await supabase
        .from('file_shares')
        .select('id')
        .eq('file_id', fileId)
        .eq('shared_with_email', email)
        .single();

      if (existingShare) {
        throw new Error('File is already shared with this email address');
      }

      // Create share record
      const { error: shareError } = await supabase
        .from('file_shares')
        .insert({
          file_id: fileId,
          owner_id: userId,
          shared_with_email: email,
          permission_level: permissionLevel,
          expires_at: expiresAt,
        });

      if (shareError) {
        throw new Error(`Failed to share file: ${shareError.message}`);
      }

      // Update file to mark as shared
      await supabase
        .from('files')
        .update({ is_shared: true })
        .eq('id', fileId);

      toast.success(`File shared with ${email}`);
    }, { operation: 'shareFile', fileId, email });
  }

  /**
   * Get file content with access control
   */
  async getFileContent(fileId: string): Promise<FileOperationResult<{ content: Blob; mimeType: string }>> {
    return handleAsync(async () => {
      const userId = await this.getCurrentUserId();
      
      // Verify file access (owner or shared with user)
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select(`
          *,
          file_shares!inner(
            shared_with_email,
            permission_level
          )
        `)
        .or(`user_id.eq.${userId},file_shares.shared_with_email.eq.${await this.getCurrentUserEmail()}`)
        .eq('id', fileId)
        .single();

      if (fileError || !file) {
        throw new Error('File not found or access denied');
      }

      if (file.is_folder) {
        throw new Error('Cannot download folder content');
      }

      if (!file.provider_file_id) {
        throw new Error('File content not available');
      }

      // Update last accessed timestamp
      await supabase
        .from('files')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', fileId);

      // Download from storage
      const { data, error } = await supabase.storage
        .from('user_uploads')
        .download(file.provider_file_id);

      if (error || !data) {
        throw new Error(`Failed to download file: ${error?.message || 'Unknown error'}`);
      }

      return {
        content: data,
        mimeType: file.mime_type || 'application/octet-stream',
      };
    }, { operation: 'getFileContent', fileId });
  }

  // Helper methods

  private async getCurrentUserId(): Promise<string> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      throw new Error('Authentication required');
    }
    return session.session.user.id;
  }

  private async getCurrentUserEmail(): Promise<string> {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.email) {
      throw new Error('Authentication required');
    }
    return session.session.user.email;
  }

  private async getFilePathById(fileId: string): Promise<string> {
    const { data, error } = await supabase
      .from('files')
      .select('path')
      .eq('id', fileId)
      .single();

    if (error || !data) {
      throw new Error('Parent folder not found');
    }

    return data.path;
  }

  private async checkNamingConflict(
    name: string, 
    parentFolderId: string | null, 
    userId: string
  ): Promise<void> {
    const { data: existing } = await supabase
      .from('files')
      .select('id')
      .eq('filename', name)
      .eq('user_id', userId)
      .eq('parent_folder_id', parentFolderId)
      .single();

    if (existing) {
      throw new Error(`A file or folder with the name "${name}" already exists in this location`);
    }
  }

  private async deleteFolderRecursively(folderId: string, userId: string): Promise<void> {
    // Get all children
    const { data: children, error: childrenError } = await supabase
      .from('files')
      .select('*')
      .eq('parent_folder_id', folderId)
      .eq('user_id', userId);

    if (childrenError) {
      throw new Error(`Failed to fetch folder contents: ${childrenError.message}`);
    }

    // Delete all children recursively
    for (const child of children || []) {
      if (child.is_folder) {
        await this.deleteFolderRecursively(child.id, userId);
      } else {
        await this.deleteFileRecord(child, userId);
      }
    }

    // Delete the folder itself
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', folderId)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete folder: ${deleteError.message}`);
    }
  }

  private async deleteFileRecord(file: FileItem, userId: string): Promise<void> {
    // Delete from storage if it's stored locally
    if (file.provider_file_id && !file.provider_id) {
      const { error: storageError } = await supabase.storage
        .from('user_uploads')
        .remove([file.provider_file_id]);

      if (storageError) {
        console.warn(`Failed to delete file from storage: ${storageError.message}`);
      }
    }

    // Delete database record
    const { error: deleteError } = await supabase
      .from('files')
      .delete()
      .eq('id', file.id)
      .eq('user_id', userId);

    if (deleteError) {
      throw new Error(`Failed to delete file record: ${deleteError.message}`);
    }
  }

  /**
   * Get upload progress for a specific upload
   */
  getUploadProgress(fileId: string): UploadProgress | undefined {
    return this.uploadProgressMap.get(fileId);
  }

  /**
   * Get all active upload progress
   */
  getAllUploadProgress(): UploadProgress[] {
    return Array.from(this.uploadProgressMap.values());
  }
}

export const enhancedFileOperations = new EnhancedFileOperations();
