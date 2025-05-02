
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { FileItem, FileShare } from '@/types/file';
import { fileOperations } from '@/services/fileOperations';
import { Loader2, X, Copy, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface FileShareDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FileShareDialog: React.FC<FileShareDialogProps> = ({ file, open, onOpenChange }) => {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState<'view' | 'edit' | 'admin'>('view');
  const [enableExpiry, setEnableExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState<FileShare[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  
  useEffect(() => {
    if (file && open) {
      loadShares();
    } else {
      setEmail('');
      setPermission('view');
      setEnableExpiry(false);
      setExpiryDate('');
    }
  }, [file, open]);
  
  const loadShares = async () => {
    if (!file) return;
    
    setSharesLoading(true);
    
    try {
      const shares = await fileOperations.getFileShares(file.id);
      setShares(shares);
    } catch (error) {
      console.error('Error loading shares:', error);
    } finally {
      setSharesLoading(false);
    }
  };
  
  const handleShare = async () => {
    if (!file || !email.trim()) return;
    
    setLoading(true);
    
    try {
      const expiresAt = enableExpiry && expiryDate ? new Date(expiryDate).toISOString() : null;
      
      await fileOperations.shareFile(file.id, email, permission, expiresAt);
      
      setEmail('');
      loadShares();
      toast.success(`File shared with ${email}`);
    } catch (error) {
      console.error('Error sharing file:', error);
      toast.error('Failed to share file');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRemoveShare = async (shareId: string) => {
    try {
      await fileOperations.removeFileShare(shareId);
      setShares(shares.filter(s => s.id !== shareId));
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Failed to remove sharing permission');
    }
  };
  
  const copyShareLink = () => {
    if (!file) return;
    
    const url = `${window.location.origin}/shared/${file.id}`;
    
    navigator.clipboard.writeText(url)
      .then(() => toast.success('Share link copied to clipboard'))
      .catch(() => toast.error('Failed to copy share link'));
  };
  
  // Set minimum date to today
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share File</DialogTitle>
          <DialogDescription>
            Share {file?.filename} with others via email or link
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex gap-2">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                placeholder="recipient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </div>
            <div className="grid w-[150px] gap-2">
              <Label htmlFor="permission">Permission</Label>
              <Select
                value={permission}
                onValueChange={(value) => setPermission(value as 'view' | 'edit' | 'admin')}
              >
                <SelectTrigger id="permission">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">View only</SelectItem>
                  <SelectItem value="edit">Can edit</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="expiry"
                checked={enableExpiry}
                onCheckedChange={setEnableExpiry}
              />
              <Label htmlFor="expiry">Set expiry date</Label>
            </div>
            
            {enableExpiry && (
              <Input
                type="date"
                className="w-[180px]"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={minDate}
              />
            )}
          </div>
          
          <Button
            onClick={handleShare}
            disabled={loading || !email.trim()}
            className="w-full"
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Share
          </Button>
          
          <div className="flex items-center justify-between">
            <Label>Share via link</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={copyShareLink}
              className="flex items-center gap-1"
            >
              <Copy className="h-4 w-4" />
              Copy Link
            </Button>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Shared with</h4>
            
            {sharesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                This file hasn't been shared with anyone yet.
              </p>
            ) : (
              <div className="space-y-2">
                {shares.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{share.shared_with_email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
                        {share.permission_level}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveShare(share.id)}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Remove</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
