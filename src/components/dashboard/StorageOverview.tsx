
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

interface StorageData {
  totalSpace: number;
  usedSpace: number;
  providers: {
    name: string;
    totalSpace: number;
    usedSpace: number;
    type: string;
  }[];
}

interface StorageOverviewProps {
  storageData: StorageData;
}

export const StorageOverview = ({ storageData }: StorageOverviewProps) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getPercentage = (used: number, total: number) => {
    return Math.round((used / total) * 100);
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium">Storage Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Total Space Used</span>
            <span className="font-medium">
              {formatSize(storageData.usedSpace)} of {formatSize(storageData.totalSpace)}
            </span>
          </div>
          <Progress value={getPercentage(storageData.usedSpace, storageData.totalSpace)} className="h-2" />
          <div className="text-xs text-right text-muted-foreground">
            {getPercentage(storageData.usedSpace, storageData.totalSpace)}% used
          </div>
        </div>
        
        <div className="mt-6 space-y-4">
          <h4 className="text-sm font-medium">By Provider</h4>
          
          {storageData.providers.map((provider) => (
            <div key={provider.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <span className="font-medium">{provider.name}</span>
                  <Badge variant="outline" className="ml-2">
                    {provider.type}
                  </Badge>
                </div>
                <span>
                  {formatSize(provider.usedSpace)} / {formatSize(provider.totalSpace)}
                </span>
              </div>
              <Progress value={getPercentage(provider.usedSpace, provider.totalSpace)} className="h-1.5" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
