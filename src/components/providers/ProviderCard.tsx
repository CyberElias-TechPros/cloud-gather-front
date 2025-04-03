
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Google, 
  Dropbox, 
  OneDrive, 
  Plus, 
  MoreVertical, 
  UploadCloud, 
  LogOut, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown 
} from '../icons/provider-icons';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ProviderInfo {
  id: string;
  name: string;
  type: 'google-drive' | 'dropbox' | 'onedrive' | 'add';
  totalSpace?: number;
  usedSpace?: number;
  status?: 'connected' | 'disconnected' | 'connecting';
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
  onChangePriority
}: ProviderCardProps) => {
  const isAdd = provider.type === 'add';
  
  const getProviderIcon = () => {
    switch (provider.type) {
      case 'google-drive': return <Google className="h-10 w-10" />;
      case 'dropbox': return <Dropbox className="h-10 w-10" />;
      case 'onedrive': return <OneDrive className="h-10 w-10" />;
      case 'add': return <Plus className="h-10 w-10" />;
      default: return null;
    }
  };
  
  const getProviderColor = () => {
    switch (provider.type) {
      case 'google-drive': return 'border-blue-100 bg-blue-50';
      case 'dropbox': return 'border-indigo-100 bg-indigo-50';
      case 'onedrive': return 'border-sky-100 bg-sky-50';
      case 'add': return 'border-gray-100 bg-gray-50';
      default: return 'border-gray-100 bg-gray-50';
    }
  };
  
  const formatSize = (bytes?: number) => {
    if (bytes === undefined) return '0 B';
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getStoragePercentage = () => {
    if (!provider.totalSpace || !provider.usedSpace) return 0;
    return (provider.usedSpace / provider.totalSpace) * 100;
  };
  
  const handleConnect = () => {
    if (onConnect) onConnect(provider);
  };
  
  const handleDisconnect = () => {
    if (onDisconnect) onDisconnect(provider);
  };
  
  const handleChangePriority = (direction: 'up' | 'down') => {
    if (onChangePriority) onChangePriority(provider, direction);
  };
  
  if (isAdd) {
    return (
      <Card className="cloud-card h-full">
        <CardContent className="flex flex-col items-center justify-center h-full p-6">
          <div className={cn("rounded-lg p-3 mb-4", getProviderColor())}>
            {getProviderIcon()}
          </div>
          <h3 className="text-lg font-medium mb-2">Add Provider</h3>
          <p className="text-sm text-muted-foreground text-center mb-4">
            Connect to a new storage provider to expand your cloud space
          </p>
          <Button onClick={handleConnect}>Connect Provider</Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="cloud-card relative overflow-hidden">
      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </DropdownMenuItem>
            <DropdownMenuItem>
              <UploadCloud className="mr-2 h-4 w-4" />
              Auto-upload settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleDisconnect}>
              <LogOut className="mr-2 h-4 w-4" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <CardHeader className="pb-2">
        <div className="flex items-center">
          <div className={cn("rounded-lg p-3 mr-3", getProviderColor())}>
            {getProviderIcon()}
          </div>
          <div>
            <h3 className="text-lg font-medium">{provider.name}</h3>
            <div className="flex items-center text-sm text-muted-foreground mt-1">
              {provider.status === 'connected' ? (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Connected
                </Badge>
              ) : provider.status === 'connecting' ? (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  Connecting...
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  Disconnected
                </Badge>
              )}
              
              {provider.priority !== undefined && (
                <Badge variant="outline" className="ml-2">
                  Priority {provider.priority}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {provider.totalSpace && provider.usedSpace && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{formatSize(provider.usedSpace)}</span>
              <span>of {formatSize(provider.totalSpace)}</span>
            </div>
            <Progress value={getStoragePercentage()} className="h-2" />
          </div>
        )}
        
        <div className="flex justify-between mt-4">
          {provider.priority !== undefined && onChangePriority && (
            <div className="flex space-x-1">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => handleChangePriority('up')}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={() => handleChangePriority('down')}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          )}
          
          {provider.status !== 'connected' && (
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
              onClick={handleConnect}
            >
              Connect
            </Button>
          )}
          
          {provider.status === 'connected' && (
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-auto"
            >
              Manage
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
