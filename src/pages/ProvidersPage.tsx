import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';
import { ConnectProviderDialog } from '@/components/providers/ConnectProviderDialog';
import { ProviderCard } from '@/components/providers/ProviderCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, PlusCircle, Loader2 } from 'lucide-react';
import { StorageProviderInfo, StorageProviderType } from '@/types/file';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const ProvidersPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<StorageProviderInfo[]>([]);
  const [connectedProviders, setConnectedProviders] = useState<StorageProviderInfo[]>([]);
  const [availableProviders, setAvailableProviders] = useState<StorageProviderInfo[]>([]);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<StorageProviderInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const allProviderTypes: {type: StorageProviderType; name: string; description: string}[] = [
    { type: 'google-drive', name: 'Google Drive', description: 'Connect your Google Drive account' },
    { type: 'dropbox', name: 'Dropbox', description: 'Connect your Dropbox account' },
    { type: 'onedrive', name: 'OneDrive', description: 'Connect your Microsoft OneDrive account' },
    { type: 'box', name: 'Box', description: 'Connect your Box account' },
    { type: 'amazon-s3', name: 'Amazon S3', description: 'Connect your Amazon S3 bucket' },
    { type: 'backblaze', name: 'Backblaze B2', description: 'Connect your Backblaze B2 bucket' },
    { type: 'mega', name: 'MEGA', description: 'Connect your MEGA account' },
    { type: 'pcloud', name: 'pCloud', description: 'Connect your pCloud account' },
    { type: 'yandex-disk', name: 'Yandex Disk', description: 'Connect your Yandex Disk account' },
    { type: 'icedrive', name: 'Icedrive', description: 'Connect your Icedrive account' },
    { type: 'sync', name: 'Sync.com', description: 'Connect your Sync.com account' }
  ];

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }
    
    loadProviders();
  }, [user, authLoading]);

  const loadProviders = async () => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('storage_providers')
        .select('*')
        .order('priority', { ascending: true });
      
      if (error) {
        throw error;
      }
      
      const connectedProvidersList: StorageProviderInfo[] = data.map(provider => ({
        id: provider.id,
        name: provider.provider_name,
        type: provider.provider_name as StorageProviderType,
        status: provider.status as 'connected' | 'disconnected' | 'error',
        totalSpace: provider.total_space || 0,
        usedSpace: provider.used_space || 0,
        description: `Connected as ${provider.provider_user_email || 'Unknown'}`,
        priority: provider.priority
      }));
      
      setConnectedProviders(connectedProvidersList);
      
      // Filter out already connected providers
      const connectedTypes = new Set(connectedProvidersList.map(p => p.type));
      const availableProvidersList = allProviderTypes
        .filter(p => !connectedTypes.has(p.type))
        .map(p => ({ ...p, id: p.type, status: undefined }));
      
      setAvailableProviders(availableProvidersList);
      setProviders([...connectedProvidersList, ...availableProvidersList]);
    } catch (error) {
      console.error('Error loading providers:', error);
      toast.error('Failed to load storage providers');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectProvider = async (provider: StorageProviderInfo) => {
    setSelectedProvider(provider);
    setConnectDialogOpen(true);
  };

  const handleProviderConnected = async () => {
    setConnectDialogOpen(false);
    setSelectedProvider(null);
    await loadProviders();
    toast.success('Provider connected successfully');
  };

  const handleDisconnectProvider = async (provider: StorageProviderInfo) => {
    try {
      const { error } = await supabase
        .from('storage_providers')
        .update({ status: 'disconnected' })
        .eq('id', provider.id);
      
      if (error) {
        throw error;
      }
      
      await loadProviders();
      toast.success(`${provider.name} disconnected`);
    } catch (error) {
      console.error('Error disconnecting provider:', error);
      toast.error('Failed to disconnect provider');
    }
  };

  const handleChangePriority = async (provider: StorageProviderInfo, direction: 'up' | 'down') => {
    // Find the current index
    const currentIndex = connectedProviders.findIndex(p => p.id === provider.id);
    if (currentIndex === -1) return;
    
    // Calculate the target index
    let targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    // Ensure the index is within bounds
    if (targetIndex < 0 || targetIndex >= connectedProviders.length) return;
    
    try {
      const swapProvider = connectedProviders[targetIndex];
      
      // Update both providers' priorities
      const updates = [
        supabase
          .from('storage_providers')
          .update({ priority: swapProvider.priority })
          .eq('id', provider.id),
        
        supabase
          .from('storage_providers')
          .update({ priority: provider.priority })
          .eq('id', swapProvider.id)
      ];
      
      await Promise.all(updates);
      
      await loadProviders();
    } catch (error) {
      console.error('Error updating provider priority:', error);
      toast.error('Failed to update priority');
    }
  };

  const filteredProviders = providers.filter(provider => 
    provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading) {
    return (
      <AppLayout title="Storage Providers">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Checking authentication...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Storage Providers">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
              prefix={<Search className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Custom Provider
          </Button>
        </div>
        
        <Tabs defaultValue="connected">
          <TabsList className="mb-4">
            <TabsTrigger value="connected">
              Connected ({connectedProviders.length})
            </TabsTrigger>
            <TabsTrigger value="available">
              Available
            </TabsTrigger>
            <TabsTrigger value="all">
              All
            </TabsTrigger>
          </TabsList>
          
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span>Loading providers...</span>
            </div>
          ) : (
            <>
              <TabsContent value="connected" className="mt-0">
                {connectedProviders.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                      <h3 className="font-medium text-lg mb-2">No connected providers</h3>
                      <p className="text-muted-foreground mb-4">
                        Connect your cloud storage providers to get started.
                      </p>
                      <Button onClick={() => {
                        const availableTab = document.querySelector('[data-value="available"]');
                        if (availableTab instanceof HTMLElement) {
                          availableTab.click();
                        }
                      }}>
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Provider
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                    {connectedProviders.map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onConnect={handleConnectProvider}
                        onDisconnect={handleDisconnectProvider}
                        onChangePriority={handleChangePriority}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="available" className="mt-0">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  {availableProviders
                    .filter(provider => provider.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((provider) => (
                      <ProviderCard
                        key={provider.id}
                        provider={provider}
                        onConnect={handleConnectProvider}
                      />
                    ))}
                </div>
              </TabsContent>
              
              <TabsContent value="all" className="mt-0">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
                  {filteredProviders.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      onConnect={handleConnectProvider}
                      onDisconnect={provider.status === 'connected' ? handleDisconnectProvider : undefined}
                      onChangePriority={provider.status === 'connected' ? handleChangePriority : undefined}
                    />
                  ))}
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
      
      {selectedProvider && (
        <ConnectProviderDialog
          open={connectDialogOpen}
          onClose={() => setConnectDialogOpen(false)}
          provider={selectedProvider.type}
          onSuccess={handleProviderConnected}
        />
      )}
    </AppLayout>
  );
};

export default ProvidersPage;
