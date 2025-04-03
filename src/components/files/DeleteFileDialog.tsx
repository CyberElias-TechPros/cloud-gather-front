
import React from 'react';
import { FileItem } from './FileCard';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

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
  onConfirm
}: DeleteFileDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete File</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{file?.name}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center p-4 bg-amber-50 rounded-md border border-amber-200 text-amber-700">
          <AlertTriangle className="h-5 w-5 mr-2 text-amber-500" />
          <div className="text-sm">
            This file will be permanently deleted from all connected storage providers.
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
