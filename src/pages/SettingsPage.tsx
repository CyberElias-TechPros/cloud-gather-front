import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  User, 
  Settings, 
  Bell, 
  Lock, 
  Shield, 
  Download, 
  HardDrive, 
  Upload, 
  Trash2, 
  LogOut, 
  Loader2,
  Save,
  Camera,
  FileWarning,
  CloudOff,
  Fingerprint
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const SettingsPage = () => {
  const { user, logout } = useAuth();
  
  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.user_metadata?.name || '',
    email: user?.email || '',
    bio: user?.user_metadata?.bio || '',
    language: 'en',
    avatar: user?.user_metadata?.avatar_url || ''
  });
  
  // Security state
  const [changePasswordForm, setChangePasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  
  // Notification state
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    fileShares: true,
    fileUpdates: true,
    teamInvites: true,
    securityAlerts: true,
    marketingEmails: false,
  });
  
  // Storage state
  const [storageSettings, setStorageSettings] = useState({
    defaultProvider: 'auto',
    compressionEnabled: true,
    autoSync: true,
    autoBackup: false,
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Handle profile form change
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileForm(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle password form change
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setChangePasswordForm(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle notification toggle
  const handleNotificationChange = (key: string, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };
  
  // Handle storage setting change
  const handleStorageSettingChange = (key: string, value: any) => {
    setStorageSettings(prev => ({ ...prev, [key]: value }));
  };
  
  // Handle profile update
  const handleUpdateProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would update the user profile in Supabase
      // await supabase.auth.updateUser({
      //   data: {
      //     name: profileForm.name,
      //     bio: profileForm.bio,
      //   }
      // });
      
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(`Failed to update profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle password change
  const handleChangePassword = async () => {
    if (!changePasswordForm.currentPassword) {
      toast.error('Current password is required');
      return;
    }
    
    if (changePasswordForm.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }
    
    if (changePasswordForm.newPassword !== changePasswordForm.confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real app, this would update the password in Supabase
      // await supabase.auth.updateUser({
      //   password: changePasswordForm.newPassword
      // });
      
      setChangePasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      toast.success('Password changed successfully');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(`Failed to change password: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle account deletion
  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real app, this would delete the account in Supabase
      // await supabase.auth.api.deleteUser(user.id);
      
      toast.success('Account deleted successfully');
      await logout();
      window.location.href = '/';
    } catch (error: any) {
      console.error('Error deleting account:', error);
      toast.error(`Failed to delete account: ${error.message}`);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };
  
  // Handle two factor auth toggle
  const handleToggleTwoFactor = async () => {
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setTwoFactorEnabled(!twoFactorEnabled);
      
      if (!twoFactorEnabled) {
        toast.success('Two-factor authentication enabled');
      } else {
        toast.success('Two-factor authentication disabled');
      }
    } catch (error: any) {
      console.error('Error toggling 2FA:', error);
      toast.error(`Failed to toggle 2FA: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle notification settings update
  const handleUpdateNotifications = async () => {
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success('Notification preferences updated');
    } catch (error: any) {
      console.error('Error updating notification settings:', error);
      toast.error(`Failed to update notification settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle storage settings update
  const handleUpdateStorageSettings = async () => {
    setLoading(true);
    try {
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 800));
      
      toast.success('Storage settings updated');
    } catch (error: any) {
      console.error('Error updating storage settings:', error);
      toast.error(`Failed to update storage settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle file upload for avatar
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // In a real app, this would upload the file to storage and update the user profile
    const reader = new FileReader();
    reader.onload = (event) => {
      setProfileForm(prev => ({
        ...prev,
        avatar: event.target?.result as string
      }));
      
      toast.success('Avatar updated');
    };
    reader.readAsDataURL(file);
  };
  
  // If not logged in
  if (!user) {
    return (
      <AppLayout title="Settings">
        <Card className="p-6">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-center text-muted-foreground">
              You need to be logged in to access account settings.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout title="Settings">
      <Tabs defaultValue="profile" className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <TabsList>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="security">
              <Lock className="h-4 w-4 mr-2" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="storage">
              <HardDrive className="h-4 w-4 mr-2" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Settings className="h-4 w-4 mr-2" />
              Advanced
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Manage your personal information and how it appears on your profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex flex-col items-center space-y-2">
                  <Avatar className="w-32 h-32">
                    <AvatarImage src={profileForm.avatar} />
                    <AvatarFallback>
                      {profileForm.name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-center">
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                      <div className="flex items-center text-primary hover:underline">
                        <Camera className="h-4 w-4 mr-1" />
                        <span>Change Photo</span>
                      </div>
                    </Label>
                    <Input 
                      id="avatar-upload" 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleAvatarUpload}
                    />
                  </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Your Name"
                      value={profileForm.name}
                      onChange={handleProfileChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@example.com"
                      value={profileForm.email}
                      disabled
                    />
                    <p className="text-xs text-muted-foreground">
                      To change your email address, please contact support
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      placeholder="Tell us about yourself"
                      value={profileForm.bio}
                      onChange={handleProfileChange}
                      rows={4}
                    />
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={profileForm.language}
                    onValueChange={(value) => 
                      setProfileForm(prev => ({ ...prev, language: value }))
                    }
                  >
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select a language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Time Zone</Label>
                  <Select defaultValue="auto">
                    <SelectTrigger>
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                      <SelectItem value="utc">UTC</SelectItem>
                      <SelectItem value="est">Eastern Time (US & Canada)</SelectItem>
                      <SelectItem value="pst">Pacific Time (US & Canada)</SelectItem>
                      <SelectItem value="gmt">GMT (London)</SelectItem>
                      <SelectItem value="cet">Central European Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline">Cancel</Button>
              <Button onClick={handleUpdateProfile} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  value={changePasswordForm.currentPassword}
                  onChange={handlePasswordChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  value={changePasswordForm.newPassword}
                  onChange={handlePasswordChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  value={changePasswordForm.confirmPassword}
                  onChange={handlePasswordChange}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleChangePassword} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <></>}
                Change Password
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <CardDescription>
                Add an extra layer of security to your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">Two-Factor Authentication</div>
                  <div className="text-sm text-muted-foreground">
                    {twoFactorEnabled 
                      ? 'Your account is protected with two-factor authentication' 
                      : 'Require a verification code when logging in'}
                  </div>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  onCheckedChange={handleToggleTwoFactor}
                  disabled={loading}
                />
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                <Shield className="h-4 w-4 inline-block mr-1" />
                Two-factor authentication adds an additional layer of security by requiring access to your phone
              </p>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage devices where you're currently logged in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {/* Current session */}
                <div className="flex items-center justify-between p-2 border rounded-lg bg-muted/50">
                  <div>
                    <div className="font-medium">Current Browser</div>
                    <div className="text-sm text-muted-foreground">
                      {navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                       navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                       navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'} - 
                      {` ${navigator.platform.includes('Win') ? 'Windows' : 
                          navigator.platform.includes('Mac') ? 'macOS' : 
                          navigator.platform.includes('Linux') ? 'Linux' : 'Unknown'}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Active now
                    </div>
                  </div>
                  <Button variant="outline" size="sm" disabled>Current</Button>
                </div>
                
                {/* Other mock sessions */}
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <div className="font-medium">Mobile App</div>
                    <div className="text-sm text-muted-foreground">
                      iPhone 13 - iOS 15.4
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last active 2 hours ago
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Logout</Button>
                </div>
                
                <div className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <div className="font-medium">Desktop App</div>
                    <div className="text-sm text-muted-foreground">
                      macOS - Version 2.3.1
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last active 5 days ago
                    </div>
                  </div>
                  <Button variant="outline" size="sm">Logout</Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                Logout from all other devices
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Login History</CardTitle>
              <CardDescription>
                Your recent account activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Mock login history */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">Successful login</div>
                    <div className="text-sm text-muted-foreground">
                      From {navigator.platform.includes('Win') ? 'Windows' : 
                            navigator.platform.includes('Mac') ? 'macOS' : 
                            navigator.platform.includes('Linux') ? 'Linux' : 'Unknown'} - 
                      {` ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 
                          navigator.userAgent.includes('Firefox') ? 'Firefox' : 
                          navigator.userAgent.includes('Safari') ? 'Safari' : 'Unknown'}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      IP: 192.168.1.1 • Today, 10:25 AM
                    </div>
                  </div>
                  <div className="text-sm font-medium text-green-600">Current Session</div>
                </div>
                
                <Separator />
                
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">Successful login</div>
                    <div className="text-sm text-muted-foreground">
                      From iPhone - Mobile App
                    </div>
                    <div className="text-xs text-muted-foreground">
                      IP: 192.168.1.1 • Yesterday, 7:12 PM
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">Successful login</div>
                    <div className="text-sm text-muted-foreground">
                      From macOS - Chrome
                    </div>
                    <div className="text-xs text-muted-foreground">
                      IP: 192.168.1.1 • Mar 26, 2023, 8:36 AM
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full">
                View Complete Login History
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Control how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="font-medium">Email Notifications</div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-notifications">Enable email notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications via email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notificationSettings.emailNotifications}
                      onCheckedChange={(checked) => 
                        handleNotificationChange('emailNotifications', checked)
                      }
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <div className="font-medium">Notification Categories</div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="file-shares">File Shares</Label>
                      <p className="text-sm text-muted-foreground">
                        When someone shares a file with you
                      </p>
                    </div>
                    <Switch
                      id="file-shares"
                      checked={notificationSettings.fileShares}
                      onCheckedChange={(checked) => 
                        handleNotificationChange('fileShares', checked)
                      }
                      disabled={!notificationSettings.emailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="file-updates">File Updates</Label>
                      <p className="text-sm text-muted-foreground">
                        When shared files are updated
                      </p>
                    </div>
                    <Switch
                      id="file-updates"
                      checked={notificationSettings.fileUpdates}
                      onCheckedChange={(checked) => 
                        handleNotificationChange('fileUpdates', checked)
                      }
                      disabled={!notificationSettings.emailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="team-invites">Team Invites</Label>
                      <p className="text-sm text-muted-foreground">
                        When you're invited to join a team
                      </p>
                    </div>
                    <Switch
                      id="team-invites"
                      checked={notificationSettings.teamInvites}
                      onCheckedChange={(checked) => 
                        handleNotificationChange('teamInvites', checked)
                      }
                      disabled={!notificationSettings.emailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="security-alerts">Security Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Important security notifications
                      </p>
                    </div>
                    <Switch
                      id="security-alerts"
                      checked={notificationSettings.securityAlerts}
                      onCheckedChange={(checked) => 
                        handleNotificationChange('securityAlerts', checked)
                      }
                    />
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="font-medium">Marketing</div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="marketing-emails">Marketing Emails</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive updates, tips, and special offers
                      </p>
                    </div>
                    <Switch
                      id="marketing-emails"
                      checked={notificationSettings.marketingEmails}
                      onCheckedChange={(checked) => 
                        handleNotificationChange('marketingEmails', checked)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateNotifications} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <></>}
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Storage Preferences</CardTitle>
              <CardDescription>
                Manage how your files are stored across providers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="default-provider">Default Storage Provider</Label>
                <Select
                  value={storageSettings.defaultProvider}
                  onValueChange={(value) => 
                    handleStorageSettingChange('defaultProvider', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a default provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Smart Routing)</SelectItem>
                    <SelectItem value="google-drive">Google Drive</SelectItem>
                    <SelectItem value="dropbox">Dropbox</SelectItem>
                    <SelectItem value="onedrive">OneDrive</SelectItem>
                    <SelectItem value="pcloud">pCloud</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  New files will be uploaded to this provider by default
                </p>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="font-medium">File Storage Settings</div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="compression">Enable File Compression</Label>
                    <p className="text-sm text-muted-foreground">
                      Compress files to save storage space
                    </p>
                  </div>
                  <Switch
                    id="compression"
                    checked={storageSettings.compressionEnabled}
                    onCheckedChange={(checked) => 
                      handleStorageSettingChange('compressionEnabled', checked)
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-sync">Auto-Sync Files</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync files between providers
                    </p>
                  </div>
                  <Switch
                    id="auto-sync"
                    checked={storageSettings.autoSync}
                    onCheckedChange={(checked) => 
                      handleStorageSettingChange('autoSync', checked)
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-backup">Auto-Backup Important Files</Label>
                    <p className="text-sm text-muted-foreground">
                      Keep multiple copies of important files across providers
                    </p>
                  </div>
                  <Switch
                    id="auto-backup"
                    checked={storageSettings.autoBackup}
                    onCheckedChange={(checked) => 
                      handleStorageSettingChange('autoBackup', checked)
                    }
                  />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <div className="font-medium mb-4">Storage Management</div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <HardDrive className="h-4 w-4 mr-2" />
                    Clear Temporary Files
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Upload className="h-4 w-4 mr-2" />
                    Export Storage Configuration
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Download className="h-4 w-4 mr-2" />
                    Download All Files (Archive)
                  </Button>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleUpdateStorageSettings} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <></>}
                Save Storage Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Backup</CardTitle>
              <CardDescription>
                Export your data or configure automatic backups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export Account Data
              </Button>
              
              <p className="text-sm text-muted-foreground">
                Your export will contain all your files, folders, and account settings
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Manage or delete your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="font-medium">Log out everywhere</div>
                <p className="text-sm text-muted-foreground">
                  This will end all active sessions and require re-authentication on all devices
                </p>
                <Button variant="outline">
                  <LogOut className="h-4 w-4 mr-2" />
                  Log Out From All Devices
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="font-medium text-red-500">Danger Zone</div>
                <p className="text-sm text-muted-foreground">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <Button 
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your account
              and remove all of your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2 bg-orange-50 text-orange-700 p-3 rounded-md">
              <FileWarning className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                All your files and folders will be permanently deleted
              </p>
            </div>
            
            <div className="flex items-center space-x-2 bg-yellow-50 text-yellow-700 p-3 rounded-md mt-2">
              <CloudOff className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                Your access to all connected storage providers will be revoked
              </p>
            </div>
            
            <div className="flex items-center space-x-2 bg-red-50 text-red-700 p-3 rounded-md mt-2">
              <Fingerprint className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">
                Your account and personal information will be permanently removed
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 text-white hover:bg-red-700 focus:ring-red-600"
              onClick={handleDeleteAccount}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <></>}
              Delete Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default SettingsPage;
