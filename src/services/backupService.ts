
import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';
import { errorHandler, ErrorCode } from '@/lib/error/ErrorHandler';

export interface BackupMetadata {
  id: string;
  name: string;
  created_at: string;
  file_count: number;
  total_size: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  user_id: string;
}

export interface RestoreOptions {
  backupId: string;
  overwriteExisting: boolean;
  targetFolderId?: string;
}

class BackupService {
  /**
   * Create a backup of user's files
   */
  async createBackup(name: string): Promise<BackupMetadata> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      // Get all user files
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', session.session.user.id);

      if (filesError) {
        throw new Error(`Failed to fetch files: ${filesError.message}`);
      }

      const totalSize = files?.reduce((sum, file) => sum + (file.size || 0), 0) || 0;

      // Create backup metadata
      const { data: backup, error: backupError } = await supabase
        .from('backups')
        .insert({
          name,
          user_id: session.session.user.id,
          file_count: files?.length || 0,
          total_size: totalSize,
          status: 'pending',
        })
        .select()
        .single();

      if (backupError) {
        throw new Error(`Failed to create backup: ${backupError.message}`);
      }

      // Start backup process asynchronously
      this.processBackup(backup.id, files || []);

      return backup;
    } catch (error) {
      errorHandler.handleError(error as Error, { operation: 'createBackup', name });
      throw error;
    }
  }

  /**
   * Process the backup creation
   */
  private async processBackup(backupId: string, files: FileItem[]): Promise<void> {
    try {
      // Update status to in_progress
      await supabase
        .from('backups')
        .update({ status: 'in_progress' })
        .eq('id', backupId);

      // Create backup data structure
      const backupData = {
        files: files.map(file => ({
          ...file,
          // Include file content for small files or references for large files
          content: file.size && file.size < 1024 * 1024 ? 'small_file_content' : null,
        })),
        metadata: {
          created_at: new Date().toISOString(),
          version: '1.0',
        },
      };

      // Store backup data (in a real implementation, you'd compress and store efficiently)
      const backupJson = JSON.stringify(backupData);
      const backupBlob = new Blob([backupJson], { type: 'application/json' });

      // Upload backup to storage
      const backupPath = `backups/${backupId}/backup.json`;
      const { error: uploadError } = await supabase.storage
        .from('user_uploads')
        .upload(backupPath, backupBlob);

      if (uploadError) {
        throw new Error(`Failed to upload backup: ${uploadError.message}`);
      }

      // Update backup status to completed
      await supabase
        .from('backups')
        .update({ 
          status: 'completed',
          backup_path: backupPath,
        })
        .eq('id', backupId);

    } catch (error) {
      // Update backup status to failed
      await supabase
        .from('backups')
        .update({ status: 'failed' })
        .eq('id', backupId);

      errorHandler.handleError(error as Error, { operation: 'processBackup', backupId });
    }
  }

  /**
   * List user's backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      const { data: backups, error } = await supabase
        .from('backups')
        .select('*')
        .eq('user_id', session.session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch backups: ${error.message}`);
      }

      return backups || [];
    } catch (error) {
      errorHandler.handleError(error as Error, { operation: 'listBackups' });
      throw error;
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      // Get backup info
      const { data: backup, error: fetchError } = await supabase
        .from('backups')
        .select('*')
        .eq('id', backupId)
        .eq('user_id', session.session.user.id)
        .single();

      if (fetchError || !backup) {
        throw new Error('Backup not found');
      }

      // Delete backup file from storage if it exists
      if (backup.backup_path) {
        await supabase.storage
          .from('user_uploads')
          .remove([backup.backup_path]);
      }

      // Delete backup metadata
      const { error: deleteError } = await supabase
        .from('backups')
        .delete()
        .eq('id', backupId)
        .eq('user_id', session.session.user.id);

      if (deleteError) {
        throw new Error(`Failed to delete backup: ${deleteError.message}`);
      }
    } catch (error) {
      errorHandler.handleError(error as Error, { operation: 'deleteBackup', backupId });
      throw error;
    }
  }

  /**
   * Restore files from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Authentication required');
      }

      // Get backup info
      const { data: backup, error: fetchError } = await supabase
        .from('backups')
        .select('*')
        .eq('id', options.backupId)
        .eq('user_id', session.session.user.id)
        .single();

      if (fetchError || !backup) {
        throw new Error('Backup not found');
      }

      if (backup.status !== 'completed') {
        throw new Error('Backup is not completed');
      }

      if (!backup.backup_path) {
        throw new Error('Backup data not found');
      }

      // Download backup data
      const { data: backupFile, error: downloadError } = await supabase.storage
        .from('user_uploads')
        .download(backup.backup_path);

      if (downloadError || !backupFile) {
        throw new Error('Failed to download backup data');
      }

      // Parse backup data
      const backupText = await backupFile.text();
      const backupData = JSON.parse(backupText);

      // Restore files
      for (const fileData of backupData.files) {
        try {
          // Check if file already exists
          if (!options.overwriteExisting) {
            const { data: existing } = await supabase
              .from('files')
              .select('id')
              .eq('user_id', session.session.user.id)
              .eq('path', fileData.path)
              .single();

            if (existing) {
              continue; // Skip existing files
            }
          }

          // Restore file metadata
          const { error: restoreError } = await supabase
            .from('files')
            .upsert({
              ...fileData,
              id: undefined, // Let database generate new ID
              user_id: session.session.user.id,
              parent_folder_id: options.targetFolderId || fileData.parent_folder_id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (restoreError) {
            console.error(`Failed to restore file ${fileData.filename}:`, restoreError);
          }
        } catch (fileError) {
          console.error(`Error restoring file ${fileData.filename}:`, fileError);
        }
      }
    } catch (error) {
      errorHandler.handleError(error as Error, { operation: 'restoreFromBackup', options });
      throw error;
    }
  }
}

export const backupService = new BackupService();
