import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProviderCard, ProviderInfo } from '@/components/providers/ProviderCard';
import { Button } from '@/components/ui/button';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const ProvidersPage = () => {
  const [providers, setProviders] = useState<ProviderInfo[]>([
    {
      id: '1',
      name: 'Google Drive',
      type: 'google-drive',
      totalSpace: 15 * 1024 * 1024 * 1024, // 15GB
      usedSpace: 12 * 1024 * 1024 * 1024, // 12GB
      status: 'connected',
      priority: 1
    },
    {
      id: '2',
      name: 'Dropbox',
      type: 'dropbox',
      totalSpace: 10 * 1024 * 1024 * 1024, // 10GB
      usedSpace: 6 * 1024 * 1024 * 1024, // 6GB
      status: 'connected',
      priority: 2
    },
    {
      id: '3',
      name: 'OneDrive',
      type: 'onedrive',
      totalSpace: 5 * 1024 * 1024 * 1024, // 5GB
      usedSpace: 2 * 1024 * 1024 * 1024, // 2GB
      status: 'connected',
      priority: 3
    }
  ]);
  
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProviderType, setSelectedProviderType] = useState<string>('');
  
  const connectProvider = () => {
    console.log('Connecting provider:', selectedProviderType);
    
    if (selectedProviderType) {
      const newProvider: ProviderInfo = {
        id: `new-${Date.now()}`,
        name: selectedProviderType === 'google-drive' 
          ? 'Google Drive' 
          : selectedProviderType === 'dropbox' 
            ? 'Dropbox' 
            : 'OneDrive',
        type: selectedProviderType as any,
        totalSpace: 5 * 1024 * 1024 * 1024,
        usedSpace: 0,
        status: 'connected',
        priority: providers.length + 1
      };
      
      setProviders([...providers, newProvider]);
      setConnectDialogOpen(false);
      setSelectedProviderType('');
    }
  };
  
  const handleConnect = (provider: ProviderInfo) => {
    console.log('Connecting to provider:', provider.name);
    
    setProviders(
      providers.map(p => 
        p.id === provider.id 
          ? { ...p, status: 'connected' } 
          : p
      )
    );
  };
  
  const handleDisconnect = (provider: ProviderInfo) => {
    console.log('Disconnecting provider:', provider.name);
    
    setProviders(
      providers.map(p => 
        p.id === provider.id 
          ? { ...p, status: 'disconnected' } 
          : p
      )
    );
  };
  
  const handleChangePriority = (provider: ProviderInfo, direction: 'up' | 'down') => {
    const currentIndex = providers.findIndex(p => p.id === provider.id);
    
    if (direction === 'up' && currentIndex > 0) {
      const newProviders = [...providers];
      const currentPriority = newProviders[currentIndex].priority || 0;
      const targetPriority = newProviders[currentIndex - 1].priority || 0;
      
      newProviders[currentIndex] = { ...newProviders[currentIndex], priority: targetPriority };
      newProviders[currentIndex - 1] = { ...newProviders[currentIndex - 1], priority: currentPriority };
      
      newProviders.sort((a, b) => (a.priority || 0) - (b.priority || 0));
      
      setProviders(newProviders);
    } else if (direction === 'down' && currentIndex < providers.length - 1) {
      const newProviders = [...providers];
      const currentPriority = newProviders[currentIndex].priority || 0;
      const targetPriority = newProviders[currentIndex + 1].priority || 0;
      
      newProviders[currentIndex] = { ...newProviders[currentIndex], priority: targetPriority };
      newProviders[currentIndex + 1] = { ...newProviders[currentIndex + 1], priority: currentPriority };
      
      newProviders.sort((a, b) => (a.priority || 0) - (b.priority || 0));
      
      setProviders(newProviders);
    }
  };
  
  const totalAllocatedSpace = providers.reduce((total, provider) => 
    total + (provider.totalSpace || 0), 0
  );
  
  const totalUsedSpace = providers.reduce((total, provider) => 
    total + (provider.usedSpace || 0), 0
  );
  
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

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
                  {formatSize(totalAllocatedSpace)}
                </div>
              </div>
              
              <div className="bg-secondary/10 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Used Space</div>
                <div className="text-2xl font-bold mt-1">
                  {formatSize(totalUsedSpace)}
                </div>
              </div>
              
              <div className="bg-accent/10 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Available Space</div>
                <div className="text-2xl font-bold mt-1">
                  {formatSize(totalAllocatedSpace - totalUsedSpace)}
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
          
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
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
                    value={selectedProviderType} 
                    onValueChange={setSelectedProviderType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="google-drive">Google Drive</SelectItem>
                      <SelectItem value="dropbox">Dropbox</SelectItem>
                      <SelectItem value="onedrive">OneDrive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Separator />
                
                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={connectProvider}>
                    Connect
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        <TabsContent value="all-providers" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers.map((provider) => (
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
              onConnect={() => setConnectDialogOpen(true)}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="connected" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers
              .filter(provider => provider.status === 'connected')
              .map((provider) => (
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
              onConnect={() => setConnectDialogOpen(true)}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="disconnected" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {providers
              .filter(provider => provider.status === 'disconnected')
              .map((provider) => (
                <ProviderCard 
                  key={provider.id}
                  provider={provider}
                  onConnect={handleConnect}
                  onDisconnect={handleDisconnect}
                />
              ))}
            
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
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default ProvidersPage;
