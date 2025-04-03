
import React, { useState } from 'react';
import { FileItem } from './FileCard';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Calendar, Shield, Users, LinkIcon, User, Clock } from 'lucide-react';

interface FileOperationsDrawerProps {
  file: FileItem | null;
  operation: 'rename' | 'share' | 'details' | null;
  onClose: () => void;
  onRename?: (file: FileItem, newName: string) => void;
  onShare?: (file: FileItem, shareSettings: any) => void;
}

export const FileOperationsDrawer = ({
  file,
  operation,
  onClose,
  onRename,
  onShare,
}: FileOperationsDrawerProps) => {
  const [newName, setNewName] = useState('');
  const [shareType, setShareType] = useState<'public' | 'restricted' | 'private'>('restricted');
  const [expirationDate, setExpirationDate] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  React.useEffect(() => {
    if (file && operation === 'rename') {
      setNewName(file.name);
    }
  }, [file, operation]);

  const handleRename = () => {
    if (file && newName.trim() && onRename) {
      onRename(file, newName.trim());
      onClose();
    }
  };

  const handleShare = () => {
    if (file && onShare) {
      onShare(file, {
        shareType,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        password: password.trim() || null,
      });
      onClose();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!file || !operation) return null;

  return (
    <Drawer open={!!operation} onOpenChange={onClose}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>
              {operation === 'rename' ? 'Rename File' : 
               operation === 'share' ? 'Share File' : 
               'File Details'}
            </DrawerTitle>
            <DrawerDescription>
              {operation === 'rename' ? 'Enter a new name for your file' : 
               operation === 'share' ? 'Configure sharing settings' : 
               file.name}
            </DrawerDescription>
          </DrawerHeader>

          {operation === 'rename' && (
            <div className="p-4 pb-0">
              <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
          )}

          {operation === 'share' && (
            <div className="p-4 pb-0 space-y-4">
              <div className="space-y-2">
                <Label>Access level</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {shareType === 'public' ? (
                        <>
                          <Users className="mr-2 h-4 w-4" />
                          <span>Public - Anyone with the link</span>
                        </>
                      ) : shareType === 'restricted' ? (
                        <>
                          <User className="mr-2 h-4 w-4" />
                          <span>Restricted - Specific people</span>
                        </>
                      ) : (
                        <>
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Private - Only you</span>
                        </>
                      )}
                      <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[200px]">
                    <DropdownMenuItem onClick={() => setShareType('public')}>
                      <Users className="mr-2 h-4 w-4" />
                      <span>Public</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShareType('restricted')}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Restricted</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setShareType('private')}>
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Private</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration</Label>
                <div className="flex gap-2">
                  <Clock className="h-4 w-4 mt-3" />
                  <Input
                    id="expiration"
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              {shareType !== 'private' && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password (optional)</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Add a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          {operation === 'details' && (
            <div className="px-4 py-2 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Name</div>
                <div className="font-medium">{file.name}</div>
                
                <div className="text-muted-foreground">Type</div>
                <div className="font-medium">{file.isFolder ? 'Folder' : file.type}</div>
                
                <div className="text-muted-foreground">Size</div>
                <div className="font-medium">{file.isFolder ? '—' : formatFileSize(file.size)}</div>
                
                <div className="text-muted-foreground">Modified</div>
                <div className="font-medium">{file.modified.toLocaleString()}</div>
                
                <div className="text-muted-foreground">Provider</div>
                <div className="font-medium">{file.provider || 'Multiple'}</div>
              </div>
            </div>
          )}

          <DrawerFooter>
            {operation === 'rename' && (
              <Button onClick={handleRename}>Rename</Button>
            )}
            {operation === 'share' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  <input 
                    className="w-full bg-transparent border-none text-sm p-0 focus:outline-none" 
                    readOnly 
                    value="https://cloudunity.com/s/abcd1234" 
                  />
                  <Button variant="ghost" size="sm" onClick={() => {}}>
                    Copy
                  </Button>
                </div>
                <Button onClick={handleShare}>Save & Share</Button>
              </div>
            )}
            {operation === 'details' && (
              <Button variant="secondary" onClick={onClose}>Close</Button>
            )}
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
