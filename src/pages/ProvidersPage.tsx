import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProviderCard, ProviderInfo } from '@/components/providers/ProviderCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { ConnectProviderDialog } from '@/components/providers/ConnectProviderDialog';
import { getStorageProviders, disconnectProvider, updateProviderPriority, getStorageUsage } from '@/services/cloudProviders';

const ProvidersPage = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageStats, setStorageStats] = useState<{
    totalSpace: number;
    usedSpace: number;
  }>({ totalSpace: 0, usedSpace: 0 });
  
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<ProviderInfo['type'] | null>(null);
  
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const providersData = await getStorageProviders();
        const formattedProviders: ProviderInfo[] = providersData.map(provider => ({
          id: provider.id,
          name: getProviderDisplayName(provider.provider_name),
          type: provider.provider_name,
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
      } catch (error) {
        console.error('Error loading providers:', error);
        toast({
          title: 'Error',
          description: 'Failed to load storage providers',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [toast]);

  const handleOpenConnect = (providerType: ProviderInfo['type']): Promise<void> => {
    setSelectedProviderType(providerType);
    setConnectDialogOpen(true);
    return Promise.resolve();
  };
  
  const handleConnect = async (provider: ProviderInfo): Promise<void> => {
    if (provider.type === 'add') {
      setConnectDialogOpen(true);
      return Promise.resolve();
    }
    
    try {
      toast({
        title: 'Connecting',
        description: `Connecting to ${provider.name}...`,
      });
      
      const providersData = await getStorageProviders();
      const formattedProviders: ProviderInfo[] = providersData.map(provider => ({
        id: provider.id,
        name: getProviderDisplayName(provider.provider_name),
        type: provider.provider_name,
        description: `Connected as ${provider.provider_user_email || 'Unknown user'}`,
        totalSpace: provider.total_space || 0,
        usedSpace: provider.used_space || 0,
        status: provider.status as any,
        priority: provider.priority
      }));
      
      setProviders(formattedProviders);
      
      toast({
        title: 'Connected',
        description: `${provider.name} connected successfully`,
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error connecting provider:', error);
      toast({
        title: 'Connection failed',
        description: 'Failed to connect storage provider',
        variant: 'destructive',
      });
      return Promise.reject(error);
    }
  };
  
  const handleDisconnect = async (provider: ProviderInfo): Promise<void> => {
    try {
      await disconnectProvider(provider.id);
      
      setProviders(prevProviders => 
        prevProviders.map(p => 
          p.id === provider.id 
            ? { ...p, status: 'disconnected' } 
            : p
        )
      );
      
      toast({
        title: 'Disconnected',
        description: `${provider.name} has been disconnected`,
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error disconnecting provider:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect provider',
        variant: 'destructive',
      });
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
      
      const newProviders = [...providers];
      const currentPriority = newProviders[currentIndex].priority!;
      const targetPriority = newProviders[targetIndex].priority!;
      
      newProviders[currentIndex] = { ...newProviders[currentIndex], priority: targetPriority };
      newProviders[targetIndex] = { ...newProviders[targetIndex], priority: currentPriority };
      
      newProviders.sort((a, b) => (a.priority || 0) - (b.priority || 0));
      
      setProviders(newProviders);
      
      toast({
        title: 'Priority updated',
        description: `${provider.name} priority has been updated`,
      });
      
      return Promise.resolve();
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error',
        description: 'Failed to update provider priority',
        variant: 'destructive',
      });
      return Promise.reject(error);
    }
  };
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const renderProviderCards = (filterStatus?: 'connected' | 'disconnected') => {
    let filteredProviders = providers;
    
    if (filterStatus) {
      filteredProviders = providers.filter(provider => provider.status === filterStatus);
    }
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProviders.map((provider) => (
          <ProviderCard 
            key={provider.id}
            provider={provider}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            onChangePriority={handleChangePriority}
          />
        ))}
        
        <ProviderCard 
          provider={{ id: 'add', name: 'Add Provider', type: 'add' }}
          onConnect={() => {
            setConnectDialogOpen(true);
            return Promise.resolve();
          }}
        />
      </div>
    );
  };

  if (loading) {
    return (
      <AppLayout title="Storage Providers">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading providers...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Storage Providers">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Storage Overview</CardTitle>
            <CardDescription>
              Total space across all connected providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-primary/10 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Total Storage</div>
                <div className="text-2xl font-bold mt-1">
                  {formatSize(storageStats.totalSpace)}
                </div>
              </div>
              
              <div className="bg-secondary/10 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Used Space</div>
                <div className="text-2xl font-bold mt-1">
                  {formatSize(storageStats.usedSpace)}
                </div>
              </div>
              
              <div className="bg-accent/10 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Available Space</div>
                <div className="text-2xl font-bold mt-1">
                  {formatSize(storageStats.totalSpace - storageStats.usedSpace)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="all-providers">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="all-providers">All Providers</TabsTrigger>
            <TabsTrigger value="connected">Connected</TabsTrigger>
            <TabsTrigger value="disconnected">Disconnected</TabsTrigger>
          </TabsList>
          
          <Button onClick={() => setConnectDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
        
        <TabsContent value="all-providers" className="mt-0">
          {renderProviderCards()}
        </TabsContent>
        
        <TabsContent value="connected" className="mt-0">
          {renderProviderCards('connected')}
        </TabsContent>
        
        <TabsContent value="disconnected" className="mt-0">
          {renderProviderCards('disconnected')}
          
          {providers.filter(provider => provider.status === 'disconnected').length === 0 && (
            <div className="col-span-3 text-center py-12">
              <div className="text-muted-foreground mb-2">
                No disconnected providers
              </div>
              <Button onClick={() => setConnectDialogOpen(true)}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {selectedProviderType && (
        <ConnectProviderDialog
          open={connectDialogOpen}
          onClose={() => {
            setConnectDialogOpen(false);
            setSelectedProviderType(null);
          }}
          provider={selectedProviderType}
          onSuccess={() => {
            getStorageProviders().then(providersData => {
              const formattedProviders: ProviderInfo[] = providersData.map(provider => ({
                id: provider.id,
                name: getProviderDisplayName(provider.provider_name),
                type: provider.provider_name,
                description: `Connected as ${provider.provider_user_email || 'Unknown user'}`,
                totalSpace: provider.total_space || 0,
                usedSpace: provider.used_space || 0,
                status: provider.status as any,
                priority: provider.priority
              }));
              
              setProviders(formattedProviders);
            });
          }}
        />
      )}
      
      <Dialog open={connectDialogOpen && !selectedProviderType} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Storage Provider</DialogTitle>
            <DialogDescription>
              Select a cloud storage provider to connect to your account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Select 
                onValueChange={(value: ProviderInfo['type']) => handleOpenConnect(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google-drive">Google Drive</SelectItem>
                  <SelectItem value="dropbox">Dropbox</SelectItem>
                  <SelectItem value="onedrive">OneDrive</SelectItem>
                  <SelectItem value="box">Box</SelectItem>
                  <SelectItem value="amazon-s3">Amazon S3</SelectItem>
                  <SelectItem value="backblaze">Backblaze</SelectItem>
                  <SelectItem value="mega">MEGA</SelectItem>
                  <SelectItem value="pcloud">pCloud</SelectItem>
                  <SelectItem value="yandex-disk">Yandex Disk</SelectItem>
                  <SelectItem value="icedrive">Icedrive</SelectItem>
                  <SelectItem value="sync">Sync.com</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default ProvidersPage;
