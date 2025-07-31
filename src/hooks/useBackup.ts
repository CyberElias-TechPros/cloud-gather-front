
import { useState, useCallback } from 'react';
import { backupService, BackupMetadata, RestoreOptions } from '@/services/mockBackupService';
import { useErrorHandler } from './useErrorHandler';
import { toast } from 'sonner';

export const useBackup = () => {
  const [backups, setBackups] = useState<BackupMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const { handleAsyncError } = useErrorHandler();

  const loadBackups = useCallback(async () => {
    setLoading(true);
    const { data, error } = await handleAsyncError(
      () => backupService.listBackups(),
      { operation: 'loadBackups' }
    );

    if (data) {
      setBackups(data);
    }
    setLoading(false);
  }, [handleAsyncError]);

  const createBackup = useCallback(async (name: string) => {
    setCreating(true);
    const { data, error } = await handleAsyncError(
      () => backupService.createBackup(name),
      { operation: 'createBackup', name }
    );

    if (data) {
      setBackups(prev => [data, ...prev]);
      toast.success('Backup creation started');
    }
    setCreating(false);
    return { data, error };
  }, [handleAsyncError]);

  const deleteBackup = useCallback(async (backupId: string) => {
    const { error } = await handleAsyncError(
      () => backupService.deleteBackup(backupId),
      { operation: 'deleteBackup', backupId }
    );

    if (!error) {
      setBackups(prev => prev.filter(backup => backup.id !== backupId));
      toast.success('Backup deleted');
    }
    return { error };
  }, [handleAsyncError]);

  const restoreBackup = useCallback(async (options: RestoreOptions) => {
    setRestoring(true);
    const { error } = await handleAsyncError(
      () => backupService.restoreFromBackup(options),
      { operation: 'restoreBackup', options }
    );

    if (!error) {
      toast.success('Backup restored successfully');
    }
    setRestoring(false);
    return { error };
  }, [handleAsyncError]);

  return {
    backups,
    loading,
    creating,
    restoring,
    loadBackups,
    createBackup,
    deleteBackup,
    restoreBackup,
  };
};
