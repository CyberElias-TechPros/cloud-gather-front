
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Clock, Lock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export const FileSharingSettings = () => {
  const [defaultPermission, setDefaultPermission] = useState('view');
  const [passwordProtection, setPasswordProtection] = useState(false);
  const [expirationEnabled, setExpirationEnabled] = useState(false);
  const [defaultExpiration, setDefaultExpiration] = useState('7');
  const [publicLinkAccess, setPublicLinkAccess] = useState(true);
  const [trackDownloads, setTrackDownloads] = useState(true);
  const [notifyOnAccess, setNotifyOnAccess] = useState(false);
  
  const { toast } = useToast();
  
  const handleSaveChanges = () => {
    toast({
      title: 'File sharing settings updated',
      description: 'Your sharing preferences have been saved.',
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="mr-2 h-5 w-5" />
            File Sharing Settings
          </CardTitle>
          <CardDescription>
            Configure default permissions and security for file sharing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Default Permissions</h3>
            <RadioGroup value={defaultPermission} onValueChange={setDefaultPermission}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="view" id="view" />
                <Label htmlFor="view">View only - Recipients can only view files</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="download" id="download" />
                <Label htmlFor="download">Download - Recipients can view and download files</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="edit" id="edit" />
                <Label htmlFor="edit">Edit - Recipients can view, download, and edit files</Label>
              </div>
            </RadioGroup>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-lg font-medium mb-4">Security</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="password-protection">Password Protection</Label>
                  <p className="text-sm text-muted-foreground">
                    Require a password to access shared files
                  </p>
                </div>
                <Switch
                  id="password-protection"
                  checked={passwordProtection}
                  onCheckedChange={setPasswordProtection}
                />
              </div>
              
              {passwordProtection && (
                <div className="ml-6 border-l-2 border-l-muted pl-4 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="default-password">Default Password Generation</Label>
                    <Select defaultValue="auto">
                      <SelectTrigger>
                        <SelectValue placeholder="Select password generation method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto-generate secure password</SelectItem>
                        <SelectItem value="manual">Enter password manually</SelectItem>
                        <SelectItem value="none">No default password</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="expiration">Link Expiration</Label>
                  <p className="text-sm text-muted-foreground">
                    Set shared links to expire after a period of time
                  </p>
                </div>
                <Switch
                  id="expiration"
                  checked={expirationEnabled}
                  onCheckedChange={setExpirationEnabled}
                />
              </div>
              
              {expirationEnabled && (
                <div className="ml-6 border-l-2 border-l-muted pl-4 pb-2">
                  <div className="space-y-2">
                    <Label htmlFor="default-expiration">Default Expiration Period</Label>
                    <Select value={defaultExpiration} onValueChange={setDefaultExpiration}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select default expiration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 day</SelectItem>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {defaultExpiration === 'custom' && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input type="number" min="1" defaultValue="14" className="w-20" />
                        <span>days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="public-access">Public Link Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow files to be shared via public links
                  </p>
                </div>
                <Switch
                  id="public-access"
                  checked={publicLinkAccess}
                  onCheckedChange={setPublicLinkAccess}
                />
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <h3 className="text-lg font-medium mb-4">Tracking & Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="track-downloads">Track File Downloads</Label>
                  <p className="text-sm text-muted-foreground">
                    Keep a record of who downloads your shared files
                  </p>
                </div>
                <Switch
                  id="track-downloads"
                  checked={trackDownloads}
                  onCheckedChange={setTrackDownloads}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="notify-access">Notify on File Access</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications when your shared files are accessed
                  </p>
                </div>
                <Switch
                  id="notify-access"
                  checked={notifyOnAccess}
                  onCheckedChange={setNotifyOnAccess}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </CardFooter>
      </Card>
    </div>
  );
};
