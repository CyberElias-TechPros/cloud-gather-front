
import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileItem } from '@/types/file';
import { deleteFile } from '@/services/cloudProviders';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeleteFileDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const DeleteFileDialog = ({
  file,
  open,
  onOpenChange,
  onConfirm,
}: DeleteFileDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);
  
  if (!file) return null;

  const handleDelete = async () => {
    if (!file) return;
    
    setIsDeleting(true);
    try {
      await deleteFile(file.id);
      toast.success(`${file.is_folder ? 'Folder' : 'File'} deleted successfully`);
      onConfirm();
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(`Failed to delete ${file.is_folder ? 'folder' : 'file'}`);
    } finally {
      setIsDeleting(false);
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {file.filename}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {file.is_folder ? 'this folder' : 'this file'}?
            {file.is_folder && ' All files and folders within this folder will also be deleted.'}
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }} 
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
