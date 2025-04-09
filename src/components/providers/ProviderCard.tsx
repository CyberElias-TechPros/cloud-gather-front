
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/utils';
import { 
  Settings, 
  RefreshCw, 
  Loader2,
  Unplug,
  AlertCircle,
  Check,
  Cloud,
  PlusCircle
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConnectProviderDialog } from './ConnectProviderDialog';
import { StorageProviderInfo } from '@/types/file';
import {
  GoogleDriveIcon,
  DropboxIcon,
  OneDriveIcon,
  BoxIcon,
  AmazonS3Icon,
  BackblazeIcon,
  MegaIcon,
  PCloudIcon,
  YandexDiskIcon,
  IcedriveIcon,
  SyncIcon
} from '@/components/icons/provider-icons';

// Define a type that explicitly includes 'add' as a provider type
type ProviderType = StorageProviderInfo['type'] | 'add';

interface ProviderCardProps {
  provider: StorageProviderInfo;
  onConnect?: (provider: StorageProviderInfo['type']) => void;
  onDisconnect?: (providerId: string) => void;
  onRefresh?: (providerId: string) => void;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onConnect,
  onDisconnect,
  onRefresh
}) => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  
  const handleConnect = () => {
    if (provider.type === 'add') {
      // This is the "Add Provider" card
      return;
    }
    
    setConnectDialogOpen(true);
  };
  
  const handleDisconnect = async () => {
    if (!onDisconnect || provider.type === 'add' || !provider.id) return;
    
    setIsDisconnecting(true);
    try {
      await onDisconnect(provider.id);
    } finally {
      setIsDisconnecting(false);
    }
  };
  
  const handleRefresh = async () => {
    if (!onRefresh || provider.type === 'add' || !provider.id) return;
    
    setIsRefreshing(true);
    try {
      await onRefresh(provider.id);
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handleConnectSuccess = () => {
    setConnectDialogOpen(false);
    if (onConnect && provider.type !== 'add') {
      onConnect(provider.type);
    }
  };

  const getProviderIcon = () => {
    switch (provider.type) {
      case 'google-drive':
        return <GoogleDriveIcon className="h-8 w-8" />;
      case 'dropbox':
        return <DropboxIcon className="h-8 w-8" />;
      case 'onedrive':
        return <OneDriveIcon className="h-8 w-8" />;
      case 'box':
        return <BoxIcon className="h-8 w-8" />;
      case 'amazon-s3':
        return <AmazonS3Icon className="h-8 w-8" />;
      case 'backblaze':
        return <BackblazeIcon className="h-8 w-8" />;
      case 'mega':
        return <MegaIcon className="h-8 w-8" />;
      case 'pcloud':
        return <PCloudIcon className="h-8 w-8" />;
      case 'yandex-disk':
        return <YandexDiskIcon className="h-8 w-8" />;
      case 'icedrive':
        return <IcedriveIcon className="h-8 w-8" />;
      case 'sync':
        return <SyncIcon className="h-8 w-8" />;
      case 'add':
        return <PlusCircle className="h-8 w-8 text-muted-foreground" />;
      default:
        return <Cloud className="h-8 w-8 text-muted-foreground" />;
    }
  };
  
  const getStatusIndicator = () => {
    if (provider.type === 'add') return null;
    
    if (!provider.status || provider.status === 'disconnected') {
      return (
        <div className="flex items-center text-muted-foreground">
          <Unplug className="h-4 w-4 mr-1" />
          <span>Disconnected</span>
        </div>
      );
    } else if (provider.status === 'error') {
      return (
        <div className="flex items-center text-destructive">
          <AlertCircle className="h-4 w-4 mr-1" />
          <span>Error</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-green-500">
          <Check className="h-4 w-4 mr-1" />
          <span>Connected</span>
        </div>
      );
    }
  };
  
  // Special case for the "Add Provider" card
  if (provider.type === 'add') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-6 h-full min-h-[220px]">
          <div className="mb-4 text-muted-foreground">
            {getProviderIcon()}
          </div>
          <h3 className="text-lg font-medium mb-2 text-center">Add Cloud Provider</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Connect another cloud storage provider
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Provider
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('google-drive')}
              >
                <GoogleDriveIcon className="mr-2 h-4 w-4" />
                Google Drive
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('dropbox')}
              >
                <DropboxIcon className="mr-2 h-4 w-4" />
                Dropbox
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('onedrive')}
              >
                <OneDriveIcon className="mr-2 h-4 w-4" />
                OneDrive
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('box')}
              >
                <BoxIcon className="mr-2 h-4 w-4" />
                Box
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('amazon-s3')}
              >
                <AmazonS3Icon className="mr-2 h-4 w-4" />
                Amazon S3
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('backblaze')}
              >
                <BackblazeIcon className="mr-2 h-4 w-4" />
                Backblaze B2
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('mega')}
              >
                <MegaIcon className="mr-2 h-4 w-4" />
                MEGA
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('pcloud')}
              >
                <PCloudIcon className="mr-2 h-4 w-4" />
                pCloud
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('yandex-disk')}
              >
                <YandexDiskIcon className="mr-2 h-4 w-4" />
                Yandex Disk
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('icedrive')}
              >
                <IcedriveIcon className="mr-2 h-4 w-4" />
                Icedrive
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onConnect && onConnect('sync')}
              >
                <SyncIcon className="mr-2 h-4 w-4" />
                Sync.com
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            {getProviderIcon()}
            <div className="ml-2">
              <CardTitle className="text-lg">{provider.name}</CardTitle>
              {getStatusIndicator()}
            </div>
          </div>
          {provider.status === 'connected' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDisconnect} className="text-destructive">
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      
      {provider.status === 'connected' && (
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  {formatBytes(provider.usedSpace || 0)} of {formatBytes(provider.totalSpace || 0)}
                </span>
                <span className="text-muted-foreground">
                  {provider.totalSpace && provider.usedSpace 
                    ? Math.round((provider.usedSpace / provider.totalSpace) * 100) 
                    : 0}%
                </span>
              </div>
              <Progress 
                value={provider.totalSpace && provider.usedSpace 
                  ? (provider.usedSpace / provider.totalSpace) * 100 
                  : 0} 
                className="h-2" 
              />
            </div>
            {provider.freeStorageSize && (
              <p className="text-sm text-muted-foreground">
                Free Space: {provider.freeStorageSize}
              </p>
            )}
          </div>
        </CardContent>
      )}
      
      <CardFooter>
        {provider.status !== 'connected' ? (
          <Button 
            onClick={handleConnect} 
            className="w-full"
          >
            Connect
          </Button>
        ) : (
          <div className="w-full flex justify-between">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disconnecting
                </>
              ) : (
                <>
                  <Unplug className="mr-2 h-4 w-4" />
                  Disconnect
                </>
              )}
            </Button>
          </div>
        )}
      </CardFooter>
      
      {/* Connect Provider Dialog */}
      <ConnectProviderDialog 
        open={connectDialogOpen} 
        onClose={() => setConnectDialogOpen(false)}
        provider={provider.type}
        onSuccess={handleConnectSuccess}
      />
    </Card>
  );
};
