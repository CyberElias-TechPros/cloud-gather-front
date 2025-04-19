import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
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
import { ArrowDown, ArrowUp, Cloud, CloudOff, AlertCircle } from 'lucide-react';

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'disconnected' | 'error';
  icon: React.ComponentType<any>;
}

export interface ProviderCardProps {
  provider: ProviderInfo;
  onConnect: (provider: ProviderInfo) => Promise<void>;
  onDisconnect: (provider: ProviderInfo) => Promise<void>;
  onChangePriority?: (provider: ProviderInfo, direction: 'up' | 'down') => Promise<void>;
}

export const ProviderCard: React.FC<ProviderCardProps> = ({ provider, onConnect, onDisconnect, onChangePriority }) => {
  const getStatusIcon = () => {
    switch (provider.status) {
      case 'connected':
        return <Cloud className="h-4 w-4 text-green-500 mr-1" />;
      case 'disconnected':
        return <CloudOff className="h-4 w-4 text-yellow-500 mr-1" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500 mr-1" />;
      default:
        return null;
    }
  };

  const handleConnect = async () => {
    await onConnect(provider);
  };

  const handleDisconnect = async () => {
    await onDisconnect(provider);
  };

  const handleChangePriority = async (direction: 'up' | 'down') => {
    if (onChangePriority) {
      await onChangePriority(provider, direction);
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col p-6">
        <div className="flex items-center mb-4">
          {React.createElement(provider.icon, { className: "h-6 w-6 mr-2" })}
          <h3 className="text-lg font-semibold">{provider.name}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{provider.description}</p>
        <div className="flex items-center text-sm text-muted-foreground mb-4">
          {getStatusIcon()}
          <span>{provider.status === 'connected' ? 'Connected' : provider.status === 'disconnected' ? 'Disconnected' : 'Error'}</span>
        </div>
        <div className="flex justify-between">
          {provider.status === 'connected' ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" onClick={handleConnect}>
              Connect
            </Button>
          )}
          {onChangePriority && (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" onClick={() => handleChangePriority('up')}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleChangePriority('down')}>
                <ArrowDown className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
