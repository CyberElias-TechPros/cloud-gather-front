
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Settings, Database, Mail, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description?: string;
}

const AdminSystemSettings = () => {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const queryClient = useQueryClient();

  const { data: systemSettings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');
      
      if (error) throw error;
      
      // Convert to key-value pairs
      const settingsMap: Record<string, any> = {};
      data.forEach((setting: SystemSetting) => {
        settingsMap[setting.setting_key] = setting.setting_value;
      });
      
      setSettings(settingsMap);
      return data;
    }
  });

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }: { key: string; value: any; description?: string }) => {
      const { data, error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          description: description || null,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update settings: ${error.message}`);
    }
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = () => {
    Object.entries(settings).forEach(([key, value]) => {
      updateSettingMutation.mutate({ key, value });
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Settings</h2>
          <p className="text-muted-foreground">
            Configure global system settings and preferences
          </p>
        </div>
        
        <Button onClick={handleSaveSettings} disabled={updateSettingMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          {updateSettingMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                General Settings
              </CardTitle>
              <CardDescription>
                Basic system configuration options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site-name">Site Name</Label>
                  <Input
                    id="site-name"
                    value={settings.site_name || 'Cloud Edifix'}
                    onChange={(e) => handleSettingChange('site_name', e.target.value)}
                    placeholder="Cloud Edifix"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="site-description">Site Description</Label>
                  <Textarea
                    id="site-description"
                    value={settings.site_description || ''}
                    onChange={(e) => handleSettingChange('site_description', e.target.value)}
                    placeholder="Universal cloud storage management platform"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable maintenance mode to disable user access
                    </p>
                  </div>
                  <Switch
                    checked={settings.maintenance_mode || false}
                    onCheckedChange={(checked) => handleSettingChange('maintenance_mode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>User Registration</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow new users to register accounts
                    </p>
                  </div>
                  <Switch
                    checked={settings.allow_registration !== false}
                    onCheckedChange={(checked) => handleSettingChange('allow_registration', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Storage Settings
              </CardTitle>
              <CardDescription>
                Configure storage limits and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max-file-size">Maximum File Size (MB)</Label>
                  <Input
                    id="max-file-size"
                    type="number"
                    value={settings.max_file_size || 100}
                    onChange={(e) => handleSettingChange('max_file_size', parseInt(e.target.value))}
                    placeholder="100"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="max-storage-per-user">Maximum Storage per User (GB)</Label>
                  <Input
                    id="max-storage-per-user"
                    type="number"
                    value={settings.max_storage_per_user || 5}
                    onChange={(e) => handleSettingChange('max_storage_per_user', parseInt(e.target.value))}
                    placeholder="5"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-delete Old Files</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically delete files not accessed for 90 days
                    </p>
                  </div>
                  <Switch
                    checked={settings.auto_delete_old_files || false}
                    onCheckedChange={(checked) => handleSettingChange('auto_delete_old_files', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    value={settings.session_timeout || 60}
                    onChange={(e) => handleSettingChange('session_timeout', parseInt(e.target.value))}
                    placeholder="60"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Require Email Verification</Label>
                    <p className="text-sm text-muted-foreground">
                      Require users to verify their email before accessing the platform
                    </p>
                  </div>
                  <Switch
                    checked={settings.require_email_verification !== false}
                    onCheckedChange={(checked) => handleSettingChange('require_email_verification', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow users to enable 2FA for enhanced security
                    </p>
                  </div>
                  <Switch
                    checked={settings.enable_2fa || false}
                    onCheckedChange={(checked) => handleSettingChange('enable_2fa', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 mr-2" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure system notifications and email settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtp-host">SMTP Host</Label>
                  <Input
                    id="smtp-host"
                    value={settings.smtp_host || ''}
                    onChange={(e) => handleSettingChange('smtp_host', e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="smtp-port">SMTP Port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    value={settings.smtp_port || 587}
                    onChange={(e) => handleSettingChange('smtp_port', parseInt(e.target.value))}
                    placeholder="587"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from-email">From Email Address</Label>
                  <Input
                    id="from-email"
                    type="email"
                    value={settings.from_email || 'noreply@cloudedifix.com'}
                    onChange={(e) => handleSettingChange('from_email', e.target.value)}
                    placeholder="noreply@cloudedifix.com"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Send email notifications for important events
                    </p>
                  </div>
                  <Switch
                    checked={settings.email_notifications !== false}
                    onCheckedChange={(checked) => handleSettingChange('email_notifications', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSystemSettings;
