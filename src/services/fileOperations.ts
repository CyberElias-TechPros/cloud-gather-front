import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';
import { toast } from 'sonner';

interface FileOperation {
  execute: () => Promise<any>;
  rollback?: () => Promise<void>;
  description: string;
}

// File operation queue
class FileOperationQueue {
  private queue: FileOperation[] = [];
  private processing = false;
  private completedOperations: FileOperation[] = [];

  async add(operation: FileOperation): Promise<any> {
    this.queue.push(operation);
    
    if (!this.processing) {
      return this.processQueue();
    }
  }

  private async processQueue(): Promise<any> {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const operation = this.queue.shift();
    
    if (!operation) {
      this.processing = false;
      return;
    }

    try {
      const result = await operation.execute();
      this.completedOperations.push(operation);
      await this.processQueue();
      return result;
    } catch (error) {
      console.error(`Error executing operation: ${operation.description}`, error);
      toast.error(`Failed to ${operation.description.toLowerCase()}`);
      
      // Attempt rollback of completed operations
      for (let i = this.completedOperations.length - 1; i >= 0; i--) {
        const op = this.completedOperations[i];
        if (op.rollback) {
          try {
            await op.rollback();
          } catch (rollbackError) {
            console.error(`Rollback failed for operation: ${op.description}`, rollbackError);
          }
        }
      }
      
      this.completedOperations = [];
      this.processing = false;
      throw error;
    }
  }
}

const operationQueue = new FileOperationQueue();

export const fileOperations = {
  async listFiles(
    parentFolderId: string | null = null,
    providerId: string | null = null,
    sortBy: 'name' | 'date' | 'size' = 'date',
    sortDirection: 'asc' | 'desc' = 'desc'
  ): Promise<FileItem[]> {
    try {
      if (providerId) {
        // If provider ID is specified, fetch files from that provider
        const { data: session } = await supabase.auth.getSession();
        
        if (!session?.session) {
          throw new Error('Authentication required');
        }

        const { data, error } = await supabase.functions.invoke('list-files', {
          body: { providerId, folderId: parentFolderId, session: session.session.access_token },
        });

        if (error) {
          throw new Error(error.message);
        }

        return data.files || [];
      } else {
        // Otherwise fetch from database
        let query = supabase.from('files').select('*');

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
          throw error;
        }

        return data || [];
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      toast.error('Failed to fetch files');
      return [];
    }
  },

  async createFolder(name: string, parentFolderId: string | null = null): Promise<FileItem | null> {
    return operationQueue.add({
      execute: async () => {
        try {
          // Determine path
          let path = `/${name}`;
          
          if (parentFolderId) {
            const { data: parentFolder, error: parentError } = await supabase
              .from('files')
              .select('path')
              .eq('id', parentFolderId)
              .single();
            
            if (parentError) {
              throw new Error('Parent folder not found');
            }
            
            path = `${parentFolder.path}/${name}`;
          }
          
          const { data, error } = await supabase
            .from('files')
            .insert({
              filename: name,
              path,
              is_folder: true,
              parent_folder_id: parentFolderId,
              size: 0
            })
            .select()
            .single();
          
          if (error) {
            throw error;
          }
          
          toast.success(`Folder "${name}" created`);
          return data;
        } catch (error) {
          console.error('Error creating folder:', error);
          throw error;
        }
      },
      description: `Create folder "${name}"`
    });
  },

  async uploadFile(
    file: File,
    parentFolderId: string | null = null,
    providerId: string | null = null,
    progressCallback?: (progress: number) => void
  ): Promise<FileItem | null> {
    return operationQueue.add({
      execute: async () => {
        try {
          const { data: session } = await supabase.auth.getSession();
          if (!session?.session) {
            throw new Error('Authentication required');
          }
          
          // Determine file path
          let path = `/${file.name}`;
          if (parentFolderId) {
            const { data: parentFolder, error: parentError } = await supabase
              .from('files')
              .select('path')
              .eq('id', parentFolderId)
              .single();
            
            if (parentError) {
              throw new Error('Parent folder not found');
            }
            
            path = `${parentFolder.path}/${file.name}`;
          }
          
          // Set up storage path
          const userId = session.session.user.id;
          const filePath = `${userId}/${Date.now()}_${file.name}`;
          
          // Upload to Supabase Storage
          const { data: storageData, error: storageError } = await supabase
            .storage
            .from('user_uploads')
            .upload(filePath, file, {
              onUploadProgress: (progress) => {
                if (progressCallback) {
                  progressCallback((progress.loaded / progress.total) * 100);
                }
              }
            });
          
          if (storageError) {
            throw storageError;
          }
          
          // Create database record
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
            })
            .select()
            .single();
          
          if (error) {
            // Attempt to clean up the storage if database insert fails
            await supabase.storage.from('user_uploads').remove([filePath]);
            throw error;
          }
          
          toast.success(`File "${file.name}" uploaded`);
          return data;
        } catch (error) {
          console.error('Error uploading file:', error);
          throw error;
        }
      },
      rollback: async () => {
        // Rollback logic would go here
      },
      description: `Upload file "${file.name}"`
    });
  },
  
  async deleteFile(file: FileItem): Promise<void> {
    return operationQueue.add({
      execute: async () => {
        try {
          if (file.is_folder) {
            // Recursively delete folder contents
            const { data: children, error: childrenError } = await supabase
              .from('files')
              .select('*')
              .eq('parent_folder_id', file.id);
            
            if (childrenError) {
              throw childrenError;
            }
            
            // Delete all children first
            for (const child of children || []) {
              await this.deleteFile(child as FileItem);
            }
          } else if (file.provider_file_id) {
            // Delete from storage if it's stored in Supabase Storage
            if (!file.provider_id) {
              await supabase.storage.from('user_uploads').remove([file.provider_file_id]);
            }
          }
          
          // Delete database record
          const { error } = await supabase
            .from('files')
            .delete()
            .eq('id', file.id);
          
          if (error) {
            throw error;
          }
          
          toast.success(`"${file.filename}" deleted`);
        } catch (error) {
          console.error('Error deleting file:', error);
          throw error;
        }
      },
      description: `Delete ${file.is_folder ? 'folder' : 'file'} "${file.filename}"`
    });
  },
  
  async renameFile(fileId: string, newName: string): Promise<FileItem | null> {
    return operationQueue.add({
      execute: async () => {
        try {
          // Get current file info
          const { data: file, error: fetchError } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();
          
          if (fetchError) {
            throw fetchError;
          }
          
          // Update path
          const oldName = file.filename;
          const oldPath = file.path;
          const newPath = oldPath.slice(0, oldPath.lastIndexOf('/') + 1) + newName;
          
          // For folders, update paths of all children
          if (file.is_folder) {
            const { data: children, error: childrenError } = await supabase
              .from('files')
              .select('*')
              .like('path', `${oldPath}/%`);
            
            if (!childrenError && children) {
              for (const child of children) {
                const updatedPath = child.path.replace(oldPath, newPath);
                await supabase
                  .from('files')
                  .update({ path: updatedPath })
                  .eq('id', child.id);
              }
            }
          }
          
          // Update the file itself
          const { data, error } = await supabase
            .from('files')
            .update({ filename: newName, path: newPath })
            .eq('id', fileId)
            .select()
            .single();
          
          if (error) {
            throw error;
          }
          
          toast.success(`Renamed "${oldName}" to "${newName}"`);
          return data;
        } catch (error) {
          console.error('Error renaming file:', error);
          throw error;
        }
      },
      description: `Rename to "${newName}"`
    });
  },

  async moveFile(fileId: string, newParentId: string | null): Promise<FileItem | null> {
    return operationQueue.add({
      execute: async () => {
        try {
          // Get current file info
          const { data: file, error: fetchError } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();
          
          if (fetchError) {
            throw fetchError;
          }
          
          // Get new parent path
          let newParentPath = '';
          if (newParentId) {
            const { data: newParent, error: newParentError } = await supabase
              .from('files')
              .select('path')
              .eq('id', newParentId)
              .single();
            
            if (newParentError) {
              throw newParentError;
            }
            
            newParentPath = newParent.path;
          }
          
          const newPath = newParentId ? `${newParentPath}/${file.filename}` : `/${file.filename}`;
          const oldPath = file.path;
          
          // For folders, update paths of all children
          if (file.is_folder) {
            const { data: children, error: childrenError } = await supabase
              .from('files')
              .select('*')
              .like('path', `${oldPath}/%`);
            
            if (!childrenError && children) {
              for (const child of children) {
                const updatedPath = child.path.replace(oldPath, newPath);
                await supabase
                  .from('files')
                  .update({ path: updatedPath })
                  .eq('id', child.id);
              }
            }
          }
          
          // Update the file itself
          const { data, error } = await supabase
            .from('files')
            .update({ path: newPath, parent_folder_id: newParentId })
            .eq('id', fileId)
            .select()
            .single();
          
          if (error) {
            throw error;
          }
          
          toast.success(`Moved "${file.filename}" to ${newParentId ? 'new location' : 'root'}`);
          return data;
        } catch (error) {
          console.error('Error moving file:', error);
          throw error;
        }
      },
      description: `Move file to ${newParentId ? 'folder' : 'root'}`
    });
  },

  async shareFile(
    fileId: string, 
    sharedWithEmail: string, 
    permissionLevel: 'view' | 'edit' | 'admin' = 'view', 
    expiresAt: string | null = null
  ): Promise<void> {
    return operationQueue.add({
      execute: async () => {
        try {
          // First update the file to mark it as shared
          const { error: fileUpdateError } = await supabase
            .from('files')
            .update({ is_shared: true })
            .eq('id', fileId);
          
          if (fileUpdateError) {
            throw fileUpdateError;
          }
          
          // Create the share record
          const { error } = await supabase
            .from('file_shares')
            .insert({
              file_id: fileId,
              shared_with_email: sharedWithEmail,
              permission_level: permissionLevel,
              expires_at: expiresAt
            });
          
          if (error) {
            throw error;
          }
          
          toast.success(`Shared with ${sharedWithEmail}`);
        } catch (error) {
          console.error('Error sharing file:', error);
          throw error;
        }
      },
      description: `Share with ${sharedWithEmail}`
    });
  },

  async getFileShares(fileId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('file_shares')
        .select('*, shared_with_profile:shared_with_id(email)')
        .eq('file_id', fileId);
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching file shares:', error);
      toast.error('Failed to load sharing information');
      return [];
    }
  },

  async removeFileShare(shareId: string): Promise<void> {
    return operationQueue.add({
      execute: async () => {
        try {
          const { error } = await supabase
            .from('file_shares')
            .delete()
            .eq('id', shareId);
          
          if (error) {
            throw error;
          }
          
          toast.success('Share removed');
        } catch (error) {
          console.error('Error removing share:', error);
          throw error;
        }
      },
      description: 'Remove file share'
    });
  },

  async starFile(fileId: string, isStarred: boolean): Promise<void> {
    return operationQueue.add({
      execute: async () => {
        try {
          const { error } = await supabase
            .from('files')
            .update({ is_starred: isStarred })
            .eq('id', fileId);
          
          if (error) {
            throw error;
          }
          
          toast.success(isStarred ? 'Added to starred' : 'Removed from starred');
        } catch (error) {
          console.error('Error updating star status:', error);
          throw error;
        }
      },
      description: isStarred ? 'Star file' : 'Unstar file'
    });
  },
  
  async getFileContent(fileId: string): Promise<{ content: Blob; mimeType: string } | null> {
    try {
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select('*')
        .eq('id', fileId)
        .single();
      
      if (fileError || !file) {
        throw fileError || new Error('File not found');
      }
      
      // Update last accessed timestamp
      await supabase
        .from('files')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', fileId);
      
      if (!file.provider_file_id || file.is_folder) {
        throw new Error('File content not available');
      }
      
      const { data, error } = await supabase
        .storage
        .from('user_uploads')
        .download(file.provider_file_id);
      
      if (error || !data) {
        throw error || new Error('Failed to download file');
      }
      
      return {
        content: data,
        mimeType: file.mime_type || 'application/octet-stream'
      };
    } catch (error) {
      console.error('Error fetching file content:', error);
      toast.error('Failed to download file');
      return null;
    }
  }
};
