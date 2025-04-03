
import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';

const SettingsPage = () => {
  const [generalSettings, setGeneralSettings] = useState({
    username: 'johndoe',
    email: 'john.doe@example.com',
    language: 'en',
    theme: 'light'
  });
  
  const [storageSettings, setStorageSettings] = useState({
    defaultUploadProvider: 'auto',
    compressionEnabled: true,
    deduplicationEnabled: true,
    encryptionEnabled: true,
    encryptionLevel: 'aes256',
    autoSplit: true,
    splitThreshold: '10'
  });
  
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    uploadComplete: true,
    downloadComplete: true,
    shareActivity: true,
    storageWarnings: true,
    newsletterUpdates: false
  });
  
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    sessionTimeout: '30',
    loginNotifications: true,
    apiAccessEnabled: false
  });
  
  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Settings updated",
      description: "Your general settings have been saved."
    });
  };
  
  const handleStorageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Storage settings updated",
      description: "Your storage settings have been saved."
    });
  };
  
  const handleNotificationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Notification settings updated",
      description: "Your notification preferences have been saved."
    });
  };
  
  const handleSecuritySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Security settings updated",
      description: "Your security settings have been saved."
    });
  };

  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="w-full md:w-auto grid grid-cols-4 md:inline-flex">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>
                Manage your account details and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGeneralSubmit} className="space-y-6">
                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input 
                        value={generalSettings.username} 
                        onChange={(e) => setGeneralSettings({...generalSettings, username: e.target.value})}
                      />
                    </FormControl>
                    <FormDescription>
                      Your unique username
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        value={generalSettings.email} 
                        onChange={(e) => setGeneralSettings({...generalSettings, email: e.target.value})}
                      />
                    </FormControl>
                    <FormDescription>
                      Your primary email address
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select 
                      value={generalSettings.language} 
                      onValueChange={(value) => setGeneralSettings({...generalSettings, language: value})}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Your preferred language for the interface
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Theme</FormLabel>
                    <RadioGroup 
                      value={generalSettings.theme} 
                      onValueChange={(value) => setGeneralSettings({...generalSettings, theme: value})}
                      className="flex gap-6"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="light" />
                        </FormControl>
                        <FormLabel className="font-normal">Light</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="dark" />
                        </FormControl>
                        <FormLabel className="font-normal">Dark</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="system" />
                        </FormControl>
                        <FormLabel className="font-normal">System</FormLabel>
                      </FormItem>
                    </RadioGroup>
                    <FormDescription>
                      Select your preferred theme
                    </FormDescription>
                  </FormItem>
                </div>
                
                <Separator />
                
                <Button type="submit">Save Changes</Button>
              </form>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Manage your account status and data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                <div>
                  <h4 className="font-medium">Export Your Data</h4>
                  <p className="text-sm text-muted-foreground">
                    Download all your file metadata and account information
                  </p>
                </div>
                <Button variant="outline">Export Data</Button>
              </div>
              
              <Separator />
              
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                <div>
                  <h4 className="font-medium text-destructive">Delete Account</h4>
                  <p className="text-sm text-muted-foreground">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <Button variant="destructive">Delete Account</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage Settings</CardTitle>
              <CardDescription>
                Configure how files are stored and managed across providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleStorageSubmit} className="space-y-6">
                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Default Upload Provider</FormLabel>
                    <Select 
                      value={storageSettings.defaultUploadProvider} 
                      onValueChange={(value) => setStorageSettings({...storageSettings, defaultUploadProvider: value})}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="auto">Automatic (Smart Allocation)</SelectItem>
                        <SelectItem value="google-drive">Google Drive</SelectItem>
                        <SelectItem value="dropbox">Dropbox</SelectItem>
                        <SelectItem value="onedrive">OneDrive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose where new files will be stored by default
                    </FormDescription>
                  </FormItem>
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">Optimization Features</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Compression</FormLabel>
                      <FormDescription>
                        Compress files to save storage space
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={storageSettings.compressionEnabled} 
                        onCheckedChange={(checked) => setStorageSettings({...storageSettings, compressionEnabled: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Deduplication</FormLabel>
                      <FormDescription>
                        Prevent storing identical files multiple times
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={storageSettings.deduplicationEnabled} 
                        onCheckedChange={(checked) => setStorageSettings({...storageSettings, deduplicationEnabled: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">Security & Privacy</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>End-to-End Encryption</FormLabel>
                      <FormDescription>
                        Encrypt files before they reach cloud providers
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={storageSettings.encryptionEnabled} 
                        onCheckedChange={(checked) => setStorageSettings({...storageSettings, encryptionEnabled: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  {storageSettings.encryptionEnabled && (
                    <FormItem>
                      <FormLabel>Encryption Level</FormLabel>
                      <Select 
                        value={storageSettings.encryptionLevel} 
                        onValueChange={(value) => setStorageSettings({...storageSettings, encryptionLevel: value})}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select encryption level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="aes128">AES-128 (Faster)</SelectItem>
                          <SelectItem value="aes256">AES-256 (More Secure)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the encryption strength
                      </FormDescription>
                    </FormItem>
                  )}
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">File Splitting</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Auto-Split Large Files</FormLabel>
                      <FormDescription>
                        Split files that exceed single provider limits
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={storageSettings.autoSplit} 
                        onCheckedChange={(checked) => setStorageSettings({...storageSettings, autoSplit: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  {storageSettings.autoSplit && (
                    <FormItem>
                      <FormLabel>Split Threshold (MB)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number"
                          value={storageSettings.splitThreshold} 
                          onChange={(e) => setStorageSettings({...storageSettings, splitThreshold: e.target.value})}
                        />
                      </FormControl>
                      <FormDescription>
                        Files larger than this will be split across providers
                      </FormDescription>
                    </FormItem>
                  )}
                </div>
                
                <Separator />
                
                <Button type="submit">Save Storage Settings</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleNotificationSubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Notification Channels</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Email Notifications</FormLabel>
                      <FormDescription>
                        Receive activity updates via email
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.emailNotifications} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, emailNotifications: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Push Notifications</FormLabel>
                      <FormDescription>
                        Receive in-app and browser notifications
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.pushNotifications} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, pushNotifications: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">Notification Types</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Upload Complete</FormLabel>
                      <FormDescription>
                        When your file uploads finish
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.uploadComplete} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, uploadComplete: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Download Complete</FormLabel>
                      <FormDescription>
                        When your file downloads finish
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.downloadComplete} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, downloadComplete: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Share Activity</FormLabel>
                      <FormDescription>
                        When others interact with your shared files
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.shareActivity} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, shareActivity: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Storage Warnings</FormLabel>
                      <FormDescription>
                        When you're approaching storage limits
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.storageWarnings} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, storageWarnings: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">Marketing</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Newsletter & Updates</FormLabel>
                      <FormDescription>
                        Receive product updates and news
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={notificationSettings.newsletterUpdates} 
                        onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, newsletterUpdates: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                </div>
                
                <Separator />
                
                <Button type="submit">Save Notification Settings</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>
                Configure your account security preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSecuritySubmit} className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Authentication</h3>
                  
                  <FormItem>
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
                      <div className="space-y-0.5">
                        <FormLabel as="div">Two-Factor Authentication</FormLabel>
                        <FormDescription>
                          Add an extra layer of security to your account
                        </FormDescription>
                      </div>
                      <div className="flex items-center">
                        <FormControl>
                          <Switch 
                            checked={securitySettings.twoFactorEnabled} 
                            onCheckedChange={(checked) => setSecuritySettings({...securitySettings, twoFactorEnabled: checked})} 
                          />
                        </FormControl>
                        <span className="ml-2 text-sm">
                          {securitySettings.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>
                    
                    {securitySettings.twoFactorEnabled && (
                      <div className="ml-6 pl-6 border-l-2 border-muted">
                        <p className="text-sm text-muted-foreground mb-4">
                          Two-factor authentication is enabled. You'll be asked for a verification code when signing in.
                        </p>
                        <Button variant="outline" size="sm">
                          Configure 2FA
                        </Button>
                      </div>
                    )}
                  </FormItem>
                  
                  <FormItem>
                    <FormLabel>Change Password</FormLabel>
                    <div className="space-y-2">
                      <Input type="password" placeholder="Current password" />
                      <Input type="password" placeholder="New password" />
                      <Input type="password" placeholder="Confirm new password" />
                    </div>
                    <div className="flex justify-start mt-2">
                      <Button variant="outline" size="sm">
                        Update Password
                      </Button>
                    </div>
                  </FormItem>
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">Session Management</h3>
                  
                  <FormItem>
                    <FormLabel>Session Timeout (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number"
                        value={securitySettings.sessionTimeout} 
                        onChange={(e) => setSecuritySettings({...securitySettings, sessionTimeout: e.target.value})}
                      />
                    </FormControl>
                    <FormDescription>
                      Automatically log out after period of inactivity (0 for no timeout)
                    </FormDescription>
                  </FormItem>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Login Notifications</FormLabel>
                      <FormDescription>
                        Get notified about new logins to your account
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={securitySettings.loginNotifications} 
                        onCheckedChange={(checked) => setSecuritySettings({...securitySettings, loginNotifications: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  <Separator />
                  
                  <h3 className="text-lg font-medium">API Access</h3>
                  
                  <FormItem className="flex items-center justify-between space-y-0">
                    <div className="space-y-0.5">
                      <FormLabel>Enable API Access</FormLabel>
                      <FormDescription>
                        Allow programmatic access to your account
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch 
                        checked={securitySettings.apiAccessEnabled} 
                        onCheckedChange={(checked) => setSecuritySettings({...securitySettings, apiAccessEnabled: checked})} 
                      />
                    </FormControl>
                  </FormItem>
                  
                  {securitySettings.apiAccessEnabled && (
                    <div className="bg-muted/40 p-4 rounded-md">
                      <h4 className="font-medium mb-2">API Keys</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Manage your API keys for programmatic access
                      </p>
                      <Button variant="outline" size="sm">
                        Manage API Keys
                      </Button>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <Button type="submit">Save Security Settings</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default SettingsPage;
