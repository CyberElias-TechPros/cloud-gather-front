
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Users, 
  Key, 
  Database, 
  Activity,
  Save,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Cloud
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface ProviderConfig {
  id: string;
  name: string;
  displayName: string;
  clientId: string | null;
  clientSecret: string | null;
  isConfigured: boolean;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  totalProviders: number;
  totalFiles: number;
  totalStorage: number;
}

const AdminPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [userStats, setUserStats] = useState<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalProviders: 0,
    totalFiles: 0,
    totalStorage: 0
  });
  
  const [providerConfigs, setProviderConfigs] = useState<ProviderConfig[]>([
    { id: 'google-drive', name: 'google-drive', displayName: 'Google Drive', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'dropbox', name: 'dropbox', displayName: 'Dropbox', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'onedrive', name: 'onedrive', displayName: 'OneDrive', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'box', name: 'box', displayName: 'Box', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'amazon-s3', name: 'amazon-s3', displayName: 'Amazon S3', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'backblaze', name: 'backblaze', displayName: 'Backblaze B2', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'mega', name: 'mega', displayName: 'MEGA', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'pcloud', name: 'pcloud', displayName: 'pCloud', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'yandex-disk', name: 'yandex-disk', displayName: 'Yandex Disk', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'icedrive', name: 'icedrive', displayName: 'Icedrive', clientId: null, clientSecret: null, isConfigured: false },
    { id: 'sync', name: 'sync', displayName: 'Sync.com', clientId: null, clientSecret: null, isConfigured: false }
  ]);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserStats(),
        loadProviderConfigs()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadProviderConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_configs')
        .select('*');

      if (error) {
        throw error;
      }

      if (data) {
        setProviderConfigs(prev => prev.map(config => {
          const dbConfig = data.find(d => d.provider_name === config.name);
          return dbConfig ? {
            ...config,
            clientId: dbConfig.client_id,
            clientSecret: dbConfig.client_secret,
            isConfigured: !!(dbConfig.client_id && dbConfig.client_secret)
          } : config;
        }));
      }
    } catch (error) {
      console.error('Error loading provider configs:', error);
    }
  };

  const loadUserStats = async () => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get active users (users with recent activity)
      const { count: activeUsers } = await supabase
        .from('files')
        .select('user_id', { count: 'exact', head: true })
        .gte('last_accessed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      // Get total providers
      const { count: totalProviders } = await supabase
        .from('storage_providers')
        .select('*', { count: 'exact', head: true });

      // Get total files
      const { count: totalFiles } = await supabase
        .from('files')
        .select('*', { count: 'exact', head: true });

      // Get total storage usage
      const { data: storageData } = await supabase
        .from('storage_providers')
        .select('used_space');

      const totalStorage = storageData?.reduce((acc, provider) => acc + (provider.used_space || 0), 0) || 0;

      setUserStats({
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        totalProviders: totalProviders || 0,
        totalFiles: totalFiles || 0,
        totalStorage
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const handleProviderConfigSave = async (providerId: string) => {
    setSaving(true);
    try {
      const config = providerConfigs.find(p => p.id === providerId);
      if (!config) return;

      const { error } = await supabase
        .from('provider_configs')
        .upsert({
          provider_name: config.name,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'provider_name'
        });

      if (error) throw error;

      toast.success(`${config.displayName} configuration saved`);
      
      // Reload configs to update the state
      await loadProviderConfigs();
    } catch (error) {
      console.error('Error saving provider config:', error);
      toast.error('Failed to save provider configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateProviderConfig = (providerId: string, field: 'clientId' | 'clientSecret', value: string) => {
    setProviderConfigs(prev => prev.map(config => 
      config.id === providerId 
        ? { ...config, [field]: value }
        : config
    ));
  };

  const toggleSecretVisibility = (providerId: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [providerId]: !prev[providerId]
    }));
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <AppLayout title="Admin Dashboard">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading admin dashboard...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Admin Dashboard">
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Badge variant="secondary">Administrator</Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.activeUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connected Providers</CardTitle>
              <Cloud className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.totalProviders}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(userStats.totalStorage)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="providers">
          <TabsList>
            <TabsTrigger value="providers">
              <Key className="h-4 w-4 mr-2" />
              Provider Configuration
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              System Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Provider Configuration</CardTitle>
                <CardDescription>
                  Configure OAuth client IDs and secrets for storage providers. These credentials enable users to connect their accounts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {providerConfigs.map((config) => (
                  <div key={config.id} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium">{config.displayName}</h3>
                        {config.isConfigured ? (
                          <Badge variant="default">Configured</Badge>
                        ) : (
                          <Badge variant="secondary">Not Configured</Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${config.id}-client-id`}>Client ID</Label>
                        <Input
                          id={`${config.id}-client-id`}
                          type="text"
                          placeholder="Enter client ID"
                          value={config.clientId || ''}
                          onChange={(e) => updateProviderConfig(config.id, 'clientId', e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${config.id}-client-secret`}>Client Secret</Label>
                        <div className="relative">
                          <Input
                            id={`${config.id}-client-secret`}
                            type={showSecrets[config.id] ? 'text' : 'password'}
                            placeholder="Enter client secret"
                            value={config.clientSecret || ''}
                            onChange={(e) => updateProviderConfig(config.id, 'clientSecret', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
                            onClick={() => toggleSecretVisibility(config.id)}
                          >
                            {showSecrets[config.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>

                    <Button 
                      onClick={() => handleProviderConfigSave(config.id)}
                      disabled={saving || !config.clientId || !config.clientSecret}
                      size="sm"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save Configuration
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure global system settings and preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Maintenance Mode</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable maintenance mode to prevent new user registrations
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">File Upload Limits</h3>
                    <p className="text-sm text-muted-foreground">
                      Set maximum file size and storage limits per user
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Security Settings</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure authentication and security policies
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Configure
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminPage;
