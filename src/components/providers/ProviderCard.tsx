
import React, { useState } from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Cloud,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  RefreshCw,
  Trash2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { ConnectProviderDialog } from './ConnectProviderDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export interface ProviderInfo {
  id: string;
  name: string;
  type: 'google-drive' | 'dropbox' | 'onedrive' | 'add';
  totalSpace?: number;
  usedSpace?: number;
  status?: 'connected' | 'disconnected' | 'error';
  priority?: number;
}

interface ProviderCardProps {
  provider: ProviderInfo;
  onConnect?: (provider: ProviderInfo) => void;
  onDisconnect?: (provider: ProviderInfo) => void;
  onChangePriority?: (provider: ProviderInfo, direction: 'up' | 'down') => void;
}

export const ProviderCard = ({
  provider,
  onConnect,
  onDisconnect,
  onChangePriority,
}: ProviderCardProps) => {
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'google-drive' | 'dropbox' | 'onedrive' | null>(null);

  const formatSize = (bytes: number | undefined) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getPercentage = (used: number | undefined, total: number | undefined) => {
    if (!used || !total) return 0;
    return Math.round((used / total) * 100);
  };

  const getProviderIcon = () => {
    switch (provider.type) {
      case 'google-drive':
        return (
          <div className="bg-red-100 text-red-600 p-3 rounded-full">
            <Cloud className="h-6 w-6" />
          </div>
        );
      case 'dropbox':
        return (
          <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
            <Cloud className="h-6 w-6" />
          </div>
        );
      case 'onedrive':
        return (
          <div className="bg-purple-100 text-purple-600 p-3 rounded-full">
            <Cloud className="h-6 w-6" />
          </div>
        );
      case 'add':
        return (
          <div className="bg-gray-100 text-gray-600 p-3 rounded-full">
            <Plus className="h-6 w-6" />
          </div>
        );
      default:
        return (
          <div className="bg-gray-100 text-gray-600 p-3 rounded-full">
            <Cloud className="h-6 w-6" />
          </div>
        );
    }
  };

  const handleConnect = (providerType: 'google-drive' | 'dropbox' | 'onedrive') => {
    setSelectedProvider(providerType);
    setConnectDialogOpen(true);
  };

  const handleConnectSuccess = () => {
    if (onConnect) {
      onConnect(provider);
    }
  };

  const handleDisconnect = () => {
    setDisconnectDialogOpen(true);
  };

  const confirmDisconnect = () => {
    if (onDisconnect) {
      onDisconnect(provider);
    }
    setDisconnectDialogOpen(false);
  };

  if (provider.type === 'add') {
    return (
      <Card className="flex flex-col justify-center items-center h-full min-h-[200px]">
        <CardContent className="pt-6 text-center">
          <div className="mb-4 flex justify-center">
            <Plus className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">Add Storage Provider</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Connect a new cloud storage service
          </p>
          <div className="flex justify-center gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConnect('google-drive')}
              className="flex items-center gap-2"
            >
              <div className="w-4 h-4">
                <svg viewBox="0 0 24 24" className="text-red-500">
                  <path
                    fill="currentColor"
                    d="M8.34 14.84c-1.72 0-3.12-1.41-3.12-3.13s1.4-3.13 3.12-3.13c.9 0 1.69.39 2.26 1.01L14.25 5c-1.62-1.42-3.72-2.3-6.03-2.3C3.9 2.7 0 6.6 0 11.35S3.9 20 8.22 20c2.6 0 4.97-1.21 6.53-3.11l-3.77-4.08c-.56.72-1.47 1.2-2.48 1.2z"
                  />
                </svg>
              </div>
              Google Drive
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConnect('dropbox')}
              className="flex items-center gap-2"
            >
              <div className="w-4 h-4 text-blue-500">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 2l6 4-6 4 6 4-6 4 6 4-6 4V2z" />
                </svg>
              </div>
              Dropbox
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleConnect('onedrive')}
              className="flex items-center gap-2"
            >
              <div className="w-4 h-4 text-blue-600">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.08 12.75c-1.7 0-3.16 1.01-3.82 2.44H7.79c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5h8.47c.66 1.43 2.12 2.44 3.82 2.44 2.32 0 4.21-1.89 4.21-4.19s-1.89-4.19-4.21-4.19z" />
                </svg>
              </div>
              OneDrive
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            {getProviderIcon()}
            <div className="ml-3">
              <h3 className="font-medium">{provider.name}</h3>
              {provider.status && (
                <Badge
                  variant={provider.status === 'connected' ? 'outline' : 'secondary'}
                  className={
                    provider.status === 'connected'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : provider.status === 'error'
                      ? 'bg-red-100 text-red-700 hover:bg-red-100'
                      : ''
                  }
                >
                  {provider.status === 'connected' ? 'Connected' : 'Disconnected'}
                </Badge>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onChangePriority && (
                <>
                  <DropdownMenuItem onClick={() => onChangePriority(provider, 'up')}>
                    <ArrowUp className="mr-2 h-4 w-4" />
                    Move Up
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onChangePriority(provider, 'down')}>
                    <ArrowDown className="mr-2 h-4 w-4" />
                    Move Down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              <DropdownMenuItem>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </DropdownMenuItem>

              {provider.status === 'connected' && onDisconnect && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDisconnect} className="text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Disconnect
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {provider.status === 'error' && (
          <div className="mb-4 p-2 bg-red-50 rounded-md text-red-600 text-sm flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            Connection error
          </div>
        )}

        {provider.totalSpace !== undefined && provider.usedSpace !== undefined && (
          <div className="space-y-2 mt-4">
            <div className="flex justify-between text-sm">
              <span>Storage</span>
              <span>
                {formatSize(provider.usedSpace)} of {formatSize(provider.totalSpace)}
              </span>
            </div>
            <Progress
              value={getPercentage(provider.usedSpace, provider.totalSpace)}
              className="h-2"
            />
            <div className="text-xs text-right text-muted-foreground">
              {getPercentage(provider.usedSpace, provider.totalSpace)}% used
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        {provider.status === 'disconnected' || provider.status === 'error' ? (
          <Button
            onClick={() => handleConnect(provider.type)}
            variant="secondary"
            className="w-full"
          >
            Connect
          </Button>
        ) : (
          <Button variant="outline" className="w-full">
            View Files
          </Button>
        )}
      </CardFooter>

      <ConnectProviderDialog
        open={connectDialogOpen}
        onClose={() => setConnectDialogOpen(false)}
        provider={selectedProvider!}
        onSuccess={handleConnectSuccess}
      />

      <AlertDialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {provider.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to disconnect {provider.name}? This will remove access to files
              stored on this service.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect} className="bg-red-600 hover:bg-red-700">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
