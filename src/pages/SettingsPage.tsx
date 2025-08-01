
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  User,
  Shield,
  Bell,
  Palette,
  Upload,
  Share2,
  Key,
  AlertTriangle,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Download,
  Loader2
} from 'lucide-react';

interface UserSettings {
  notifications: {
    email: boolean;
    desktop: boolean;
    fileShared: boolean;
    storageAlerts: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private';
    allowIndexing: boolean;
  };
  upload: {
    autoBackup: boolean;
    compressImages: boolean;
    maxFileSize: number;
  };
  display: {
    theme: 'light' | 'dark' | 'system';
    language: string;
    dateFormat: string;
  };
}

const SettingsPage = () => {
  const { user, profile, updateProfile, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      desktop: false,
      fileShared: true,
      storageAlerts: true,
    },
    privacy: {
      profileVisibility: 'private',
      allowIndexing: false,
    },
    upload: {
      autoBackup: true,
      compressImages: false,
      maxFileSize: 100, // MB
    },
    display: {
      theme: 'system',
      language: 'en',
      dateFormat: 'MM/DD/YYYY',
    },
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    
    setDisplayName(profile?.display_name || user.email?.split('@')[0] || '');
    loadUserSettings();
  }, [user, profile, authLoading]);

  const loadUserSettings = async () => {
    setLoading(true);
    try {
      // In a real app, you'd load these from a user_settings table
      // For now, we'll use localStorage as a fallback
      const savedSettings = localStorage.getItem('user_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: Partial<UserSettings>) => {
    setSaving(true);
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      
      // In a real app, you'd save to a user_settings table
      localStorage.setItem('user_settings', JSON.stringify(updatedSettings));
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateDisplayName = async () => {
    if (!displayName.trim()) {
      toast.error('Display name cannot be empty');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      toast.success('Display name updated successfully');
    } catch (error) {
      console.error('Error updating display name:', error);
      toast.error('Failed to update display name');
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  const exportData = async () => {
    setSaving(true);
    try {
      // Get user's files
      const { data: files, error } = await supabase
        .from('files')
        .select('*');

      if (error) throw error;

      const exportData = {
        profile: {
          email: user?.email,
          displayName: profile?.display_name,
          createdAt: user?.created_at,
        },
        files: files || [],
        settings,
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cloudedifix-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    
    if (!confirmed) return;

    setSaving(true);
    try {
      // In a real app, this would trigger a secure account deletion process
      toast.error('Account deletion is not implemented in this demo');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <AppLayout title="Settings">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading settings...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Settings">
      <div className="max-w-4xl mx-auto space-y-6">
        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          {/* Profile Settings */}
          <TabsContent value="profile" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {displayName.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-2">
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Photo
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      JPG, GIF or PNG. Max size of 2MB.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Enter your display name"
                      />
                      <Button 
                        onClick={updateDisplayName}
                        disabled={saving}
                        size="sm"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <Input
                      value={user?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email cannot be changed
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings */}
          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Change Password</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <div className="relative">
                        <Input
                          id="currentPassword"
                          type={showPassword ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input
                        id="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <Button onClick={updatePassword} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Update Password
                  </Button>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Two-Factor Authentication</h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm">Enhance your account security</p>
                      <p className="text-xs text-muted-foreground">
                        Add an extra layer of security with 2FA
                      </p>
                    </div>
                    <Badge variant="secondary">Coming Soon</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notifications Settings */}
          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {[
                    { key: 'email', label: 'Email Notifications', description: 'Receive notifications via email' },
                    { key: 'desktop', label: 'Desktop Notifications', description: 'Show notifications in your browser' },
                    { key: 'fileShared', label: 'File Sharing', description: 'When someone shares a file with you' },
                    { key: 'storageAlerts', label: 'Storage Alerts', description: 'When storage is running low' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch
                        checked={settings.notifications[item.key as keyof typeof settings.notifications]}
                        onCheckedChange={(checked) => {
                          const newNotifications = { ...settings.notifications, [item.key]: checked };
                          saveSettings({ notifications: newNotifications });
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Settings */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Display & Language
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Theme</Label>
                    <Select
                      value={settings.display.theme}
                      onValueChange={(value: 'light' | 'dark' | 'system') => {
                        saveSettings({ display: { ...settings.display, theme: value } });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={settings.display.language}
                      onValueChange={(value) => {
                        saveSettings({ display: { ...settings.display, language: value } });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Auto Backup</p>
                      <p className="text-xs text-muted-foreground">
                        Automatically backup files to connected providers
                      </p>
                    </div>
                    <Switch
                      checked={settings.upload.autoBackup}
                      onCheckedChange={(checked) => {
                        saveSettings({ upload: { ...settings.upload, autoBackup: checked } });
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Compress Images</p>
                      <p className="text-xs text-muted-foreground">
                        Automatically compress images to save space
                      </p>
                    </div>
                    <Switch
                      checked={settings.upload.compressImages}
                      onCheckedChange={(checked) => {
                        saveSettings({ upload: { ...settings.upload, compressImages: checked } });
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data & Privacy */}
          <TabsContent value="data" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Data Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Export Your Data</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Download a copy of all your data including files, settings, and account information.
                    </p>
                    <Button onClick={exportData} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                      Export Data
                    </Button>
                  </div>

                  <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
                    <h4 className="font-medium mb-2 text-destructive">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button 
                      variant="destructive"
                      onClick={deleteAccount}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
