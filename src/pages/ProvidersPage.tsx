
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProviderCard, ProviderInfo } from '@/components/providers/ProviderCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Loader2, Settings, Cloud, CloudOff } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ConnectProviderDialog } from '@/components/providers/ConnectProviderDialog';
import { getStorageProviders, disconnectProvider, updateProviderPriority, getStorageUsage } from '@/services/cloudProviders';
import { getProviderDisplayName } from '@/types/file';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';

const ProvidersPage = () => {
  const { user, session } = useAuth();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<{
    totalSpace: number;
    usedSpace: number;
  }>({ totalSpace: 0, usedSpace: 0 });
  
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<ProviderInfo['type'] | null>(null);
  
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const providersData = await getStorageProviders();
        const formattedProviders: ProviderInfo[] = providersData.map(provider => ({
          id: provider.id,
          name: getProviderDisplayName(provider.provider_name),
          type: provider.provider_name as any,
          description: `Connected as ${provider.provider_user_email || 'Unknown user'}`,
          totalSpace: provider.total_space || 0,
          usedSpace: provider.used_space || 0,
          status: provider.status as any,
          priority: provider.priority
        }));
        setProviders(formattedProviders);
        
        const storage = await getStorageUsage();
        setStorageStats({
          totalSpace: storage.totalSpace,
          usedSpace: storage.usedSpace
        });
      } catch (error: any) {
        console.error('Error loading providers:', error);
        toast.error(`Failed to load storage providers: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user]);

  const handleOpenConnect = (providerType: ProviderInfo['type']) => {
    setSelectedProviderType(providerType);
    setConnectDialogOpen(true);
  };
  
  const handleConnect = async (provider: ProviderInfo): Promise<void> => {
    if (provider.type === 'add') {
      setConnectDialogOpen(true);
      return Promise.resolve();
    }
    
    try {
      toast.loading(`Connecting to ${provider.name}...`);
      
      // After connection is successful
      const providersData = await getStorageProviders();
      const formattedProviders: ProviderInfo[] = providersData.map(provider => ({
        id: provider.id,
        name: getProviderDisplayName(provider.provider_name),
        type: provider.provider_name as any,
        description: `Connected as ${provider.provider_user_email || 'Unknown user'}`,
        totalSpace: provider.total_space || 0,
        usedSpace: provider.used_space || 0,
        status: provider.status as any,
        priority: provider.priority
      }));
      
      setProviders(formattedProviders);
      
      toast.success(`${provider.name} connected successfully`);
      return Promise.resolve();
    } catch (error: any) {
      console.error('Error connecting provider:', error);
      toast.error(`Failed to connect ${provider.name}: ${error.message}`);
      return Promise.reject(error);
    }
  };
  
  const handleDisconnect = async (provider: ProviderInfo): Promise<void> => {
    try {
      toast.loading(`Disconnecting ${provider.name}...`);
      await disconnectProvider(provider.id);
      
      setProviders(prevProviders => 
        prevProviders.map(p => 
          p.id === provider.id 
            ? { ...p, status: 'disconnected' } 
            : p
        )
      );
      
      toast.success(`${provider.name} has been disconnected`);
      return Promise.resolve();
    } catch (error: any) {
      console.error('Error disconnecting provider:', error);
      toast.error(`Failed to disconnect ${provider.name}: ${error.message}`);
      return Promise.reject(error);
    }
  };
  
  const handleChangePriority = async (provider: ProviderInfo, direction: 'up' | 'down'): Promise<void> => {
    const currentIndex = providers.findIndex(p => p.id === provider.id);
    
    if ((direction === 'up' && currentIndex <= 0) || 
        (direction === 'down' && currentIndex >= providers.length - 1)) {
      return Promise.resolve();
    }
    
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetProvider = providers[targetIndex];
    
    try {
      await updateProviderPriority(provider.id, targetProvider.priority!);
      await updateProviderPriority(targetProvider.id, provider.priority!);
      
      // Update the local state to reflect the changes
      setProviders(prevProviders => {
        const updatedProviders = [...prevProviders];
        updatedProviders[currentIndex] = { ...targetProvider };
        updatedProviders[targetIndex] = { ...provider };
        return updatedProviders;
      });
      
      return Promise.resolve();
    } catch (error: any) {
      console.error('Error updating provider priority:', error);
      toast.error(`Failed to update provider priority: ${error.message}`);
      return Promise.reject(error);
    }
  };
  
  const getAvailableProviders = (): ProviderInfo[] => {
    const connectedProviderTypes = providers
      .filter(p => p.status === 'connected')
      .map(p => p.type);
    
    // Create a list of available providers that aren't already connected
    const availableProviders: ProviderInfo[] = [
      {
        id: 'google-drive',
        name: 'Google Drive',
        type: 'google-drive',
        description: 'Connect to your Google Drive account',
        status: 'disconnected'
      },
      {
        id: 'dropbox',
        name: 'Dropbox',
        type: 'dropbox',
        description: 'Connect to your Dropbox account',
        status: 'disconnected'
      },
      {
        id: 'onedrive',
        name: 'OneDrive',
        type: 'onedrive',
        description: 'Connect to your Microsoft OneDrive account',
        status: 'disconnected'
      },
      {
        id: 'box',
        name: 'Box',
        type: 'box',
        description: 'Connect to your Box account',
        status: 'disconnected'
      },
      {
        id: 'amazon-s3',
        name: 'Amazon S3',
        type: 'amazon-s3',
        description: 'Connect to your Amazon S3 bucket',
        status: 'disconnected'
      },
      {
        id: 'backblaze',
        name: 'Backblaze B2',
        type: 'backblaze',
        description: 'Connect to your Backblaze B2 storage',
        status: 'disconnected'
      },
      {
        id: 'mega',
        name: 'MEGA',
        type: 'mega',
        description: 'Connect to your MEGA account',
        status: 'disconnected'
      },
      {
        id: 'pcloud',
        name: 'pCloud',
        type: 'pcloud',
        description: 'Connect to your pCloud account',
        status: 'disconnected'
      },
      {
        id: 'yandex-disk',
        name: 'Yandex Disk',
        type: 'yandex-disk',
        description: 'Connect to your Yandex Disk',
        status: 'disconnected'
      },
      {
        id: 'icedrive',
        name: 'Icedrive',
        type: 'icedrive',
        description: 'Connect to your Icedrive account',
        status: 'disconnected'
      },
      {
        id: 'sync',
        name: 'Sync.com',
        type: 'sync',
        description: 'Connect to your Sync.com account',
        status: 'disconnected'
      }
    ].filter(p => !connectedProviderTypes.includes(p.type));
    
    return availableProviders;
  };

  const handleConnectSuccess = async () => {
    setConnectDialogOpen(false);
    setSelectedProviderType(null);
    
    // Reload providers
    setLoading(true);
    try {
      const providersData = await getStorageProviders();
      const formattedProviders: ProviderInfo[] = providersData.map(provider => ({
        id: provider.id,
        name: getProviderDisplayName(provider.provider_name),
        type: provider.provider_name as any,
        description: `Connected as ${provider.provider_user_email || 'Unknown user'}`,
        totalSpace: provider.total_space || 0,
        usedSpace: provider.used_space || 0,
        status: provider.status as any,
        priority: provider.priority
      }));
      setProviders(formattedProviders);
      
      const storage = await getStorageUsage();
      setStorageStats({
        totalSpace: storage.totalSpace,
        usedSpace: storage.usedSpace
      });
      
      toast.success('Provider connected successfully!');
    } catch (error: any) {
      console.error('Error refreshing providers after connection:', error);
      toast.error(`Error refreshing providers: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  if (!user) {
    return (
      <AppLayout title="Storage Providers">
        <Card className="p-6">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-center text-muted-foreground">
              You need to be logged in to manage your storage providers.
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
    <AppLayout title="Storage Providers">
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Storage Overview</CardTitle>
            <CardDescription>
              Manage your connected storage providers and view usage statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Storage Usage</span>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(storageStats.usedSpace)} / {formatBytes(storageStats.totalSpace)}
                </span>
              </div>
              <Progress 
                value={(storageStats.usedSpace / storageStats.totalSpace) * 100} 
                className="h-2"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Connected Providers</span>
                <span className="text-2xl font-bold">
                  {providers.filter(p => p.status === 'connected').length}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">Total Space</span>
                <span className="text-2xl font-bold">
                  {formatBytes(storageStats.totalSpace)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="connected">
        <TabsList className="mb-4">
          <TabsTrigger value="connected">
            <Cloud className="h-4 w-4 mr-2" />
            Connected
          </TabsTrigger>
          <TabsTrigger value="available">
            <PlusCircle className="h-4 w-4 mr-2" />
            Available
          </TabsTrigger>
          <TabsTrigger value="disconnected">
            <CloudOff className="h-4 w-4 mr-2" />
            Disconnected
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="connected">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span>Loading providers...</span>
            </div>
          ) : (
            <>
              {providers.filter(p => p.status === 'connected').length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
                    <Cloud className="h-12 w-12 text-muted-foreground mb-2" />
                    <h2 className="text-xl font-semibold">No Connected Providers</h2>
                    <p className="text-center text-muted-foreground">
                      You don't have any storage providers connected yet. Add one to get started.
                    </p>
                    <Button onClick={() => handleOpenConnect('google-drive')}>
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Connect a Provider
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {providers
                    .filter(provider => provider.status === 'connected')
                    .sort((a, b) => (a.priority || 0) - (b.priority || 0))
                    .map(provider => (
                      <ProviderCard 
                        key={provider.id}
                        provider={provider}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onChangePriority={handleChangePriority}
                      />
                    ))
                  }
                </div>
              )}
            </>
          )}
        </TabsContent>
        
        <TabsContent value="available">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getAvailableProviders().map(provider => (
              <ProviderCard 
                key={provider.id}
                provider={provider}
                onConnect={() => handleOpenConnect(provider.type)}
              />
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="disconnected">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers
              .filter(provider => provider.status === 'disconnected')
              .map(provider => (
                <ProviderCard 
                  key={provider.id}
                  provider={provider}
                  onConnect={handleConnect}
                />
              ))
            }
            {providers.filter(p => p.status === 'disconnected').length === 0 && (
              <Card className="col-span-3">
                <CardContent className="flex flex-col items-center justify-center space-y-4 p-6">
                  <CloudOff className="h-12 w-12 text-muted-foreground mb-2" />
                  <h2 className="text-xl font-semibold">No Disconnected Providers</h2>
                  <p className="text-center text-muted-foreground">
                    You don't have any disconnected providers.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      {selectedProviderType && (
        <ConnectProviderDialog
          open={connectDialogOpen}
          onClose={() => setConnectDialogOpen(false)}
          provider={selectedProviderType}
          onSuccess={handleConnectSuccess}
        />
      )}
    </AppLayout>
  );
};

export default ProvidersPage;
