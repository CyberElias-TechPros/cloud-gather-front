
import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileItem } from '@/types/file';
import { formatDistanceToNow } from 'date-fns';
import { Check, Share2, FileText, Pencil } from 'lucide-react';

interface FileOperationsDrawerProps {
  file: FileItem | null;
  operation: 'rename' | 'share' | 'details' | null;
  onClose: () => void;
  onRename?: (file: FileItem, newName: string) => void;
  onShare?: (file: FileItem, shareSettings: { email: string; permission: 'view' | 'edit' | 'admin' }) => void;
}

export const FileOperationsDrawer = ({
  file,
  operation,
  onClose,
  onRename,
  onShare,
}: FileOperationsDrawerProps) => {
  const [newName, setNewName] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit' | 'admin'>('view');

  React.useEffect(() => {
    if (file && operation === 'rename') {
      setNewName(file.filename);
    }
  }, [file, operation]);

  const handleRename = () => {
    if (file && newName && onRename) {
      onRename(file, newName);
    }
  };

  const handleShare = () => {
    if (file && shareEmail && onShare) {
      onShare(file, { email: shareEmail, permission: sharePermission });
    }
  };

  if (!file) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderContent = () => {
    switch (operation) {
      case 'rename':
        return (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center">
                <Pencil className="h-5 w-5 mr-2" />
                Rename {file.is_folder ? 'Folder' : 'File'}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="new-name">New Name</Label>
                  <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Enter new name"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <DrawerFooter>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleRename} disabled={!newName || newName === file.filename}>
                  <Check className="h-4 w-4 mr-2" />
                  Rename
                </Button>
              </div>
            </DrawerFooter>
          </>
        );

      case 'share':
        return (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center">
                <Share2 className="h-5 w-5 mr-2" />
                Share {file.filename}
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="share-email">Email Address</Label>
                  <Input
                    id="share-email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    type="email"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="share-permission">Permission</Label>
                  <Select value={sharePermission} onValueChange={(value: any) => setSharePermission(value)}>
                    <SelectTrigger id="share-permission">
                      <SelectValue placeholder="Select permission" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">View only</SelectItem>
                      <SelectItem value="edit">Can edit</SelectItem>
                      <SelectItem value="admin">Full access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleShare} disabled={!shareEmail}>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
              </div>
            </DrawerFooter>
          </>
        );

      case 'details':
        return (
          <>
            <DrawerHeader>
              <DrawerTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                File Details
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4">
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="text-sm font-medium">Name:</div>
                  <div className="text-sm">{file.filename}</div>
                  
                  <div className="text-sm font-medium">Type:</div>
                  <div className="text-sm">
                    {file.is_folder ? 'Folder' : file.mime_type || 'Unknown'}
                  </div>
                  
                  <div className="text-sm font-medium">Size:</div>
                  <div className="text-sm">{file.is_folder ? '—' : formatFileSize(file.size)}</div>
                  
                  <div className="text-sm font-medium">Modified:</div>
                  <div className="text-sm">
                    {formatDistanceToNow(new Date(file.updated_at), { addSuffix: true })}
                  </div>
                  
                  <div className="text-sm font-medium">Created:</div>
                  <div className="text-sm">
                    {formatDistanceToNow(new Date(file.created_at), { addSuffix: true })}
                  </div>
                  
                  {file.provider_id && (
                    <>
                      <div className="text-sm font-medium">Provider:</div>
                      <div className="text-sm">{file.provider || 'External Storage'}</div>
                    </>
                  )}
                  
                  <div className="text-sm font-medium">Path:</div>
                  <div className="text-sm truncate">{file.path}</div>
                </div>
              </div>
            </div>
            <DrawerFooter>
              <Button onClick={onClose}>Close</Button>
            </DrawerFooter>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Drawer open={!!operation} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent>{renderContent()}</DrawerContent>
    </Drawer>
  );
};
