
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  HardDrive,
  PieChart,
  Cloud,
  Trash2,
  Download,
  Upload,
  AlertTriangle,
  TrendingUp,
  FileText,
  Folder,
  Image,
  Video,
  Music,
  Archive,
  Loader2
} from 'lucide-react';

interface StorageInfo {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, { count: number; size: number }>;
  providerUsage: {
    id: string;
    name: string;
    usedSpace: number;
    totalSpace: number;
    status: string;
  }[];
  recentUploads: {
    id: string;
    filename: string;
    size: number;
    uploadedAt: string;
    mimeType?: string;
  }[];
}

const StoragePage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    totalFiles: 0,
    totalSize: 0,
    filesByType: {},
    providerUsage: [],
    recentUploads: []
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    
    loadStorageData();
  }, [user, authLoading]);

  const loadStorageData = async () => {
    setLoading(true);
    
    try {
      // Load files data
      const { data: files, error: filesError } = await supabase
        .from('files')
        .select('id, filename, size, mime_type, created_at, is_folder')
        .order('created_at', { ascending: false });

      if (filesError) throw filesError;

      // Load providers data
      const { data: providers, error: providersError } = await supabase
        .from('storage_providers')
        .select('id, provider_name, used_space, total_space, status')
        .eq('status', 'connected');

      if (providersError) throw providersError;

      // Process files by type
      const filesByType: Record<string, { count: number; size: number }> = {};
      
      files?.forEach(file => {
        if (file.is_folder) return;
        
        let category = 'Other';
        if (file.mime_type) {
          if (file.mime_type.startsWith('image/')) category = 'Images';
          else if (file.mime_type.startsWith('video/')) category = 'Videos';
          else if (file.mime_type.startsWith('audio/')) category = 'Audio';
          else if (file.mime_type.includes('pdf') || file.mime_type.includes('document')) category = 'Documents';
          else if (file.mime_type.includes('zip') || file.mime_type.includes('archive')) category = 'Archives';
        }
        
        if (!filesByType[category]) {
          filesByType[category] = { count: 0, size: 0 };
        }
        
        filesByType[category].count++;
        filesByType[category].size += file.size || 0;
      });

      // Get recent uploads
      const recentUploads = files?.slice(0, 10).filter(file => !file.is_folder).map(file => ({
        id: file.id,
        filename: file.filename,
        size: file.size || 0,
        uploadedAt: file.created_at,
        mimeType: file.mime_type
      })) || [];

      // Process provider usage
      const providerUsage = providers?.map(provider => ({
        id: provider.id,
        name: provider.provider_name,
        usedSpace: provider.used_space || 0,
        totalSpace: provider.total_space || 0,
        status: provider.status
      })) || [];

      setStorageInfo({
        totalFiles: files?.filter(file => !file.is_folder)?.length || 0,
        totalSize: files?.reduce((acc, file) => acc + (file.size || 0), 0) || 0,
        filesByType,
        providerUsage,
        recentUploads
      });

    } catch (error) {
      console.error('Error loading storage data:', error);
      toast.error('Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'Images': return Image;
      case 'Videos': return Video;
      case 'Audio': return Music;
      case 'Documents': return FileText;
      case 'Archives': return Archive;
      case 'Folders': return Folder;
      default: return FileText;
    }
  };

  const totalProviderSpace = storageInfo.providerUsage.reduce((acc, provider) => acc + provider.totalSpace, 0);
  const totalUsedSpace = storageInfo.providerUsage.reduce((acc, provider) => acc + provider.usedSpace, 0);
  const usagePercentage = totalProviderSpace > 0 ? (totalUsedSpace / totalProviderSpace) * 100 : 0;

  if (authLoading || loading) {
    return (
      <AppLayout title="Storage">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading storage data...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Storage">
      <div className="space-y-6">
        {/* Storage Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(totalProviderSpace)}</div>
              <p className="text-xs text-muted-foreground">
                Across all providers
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Used Storage</CardTitle>
              <PieChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatBytes(totalUsedSpace)}</div>
              <p className="text-xs text-muted-foreground">
                {usagePercentage.toFixed(1)}% of total space
              </p>
              <Progress value={usagePercentage} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Files Count</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{storageInfo.totalFiles}</div>
              <p className="text-xs text-muted-foreground">
                Total files stored
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="cleanup">Cleanup</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* File Types Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Storage by File Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(storageInfo.filesByType).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No files found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(storageInfo.filesByType)
                        .sort(([,a], [,b]) => b.size - a.size)
                        .map(([type, info]) => {
                          const Icon = getFileTypeIcon(type);
                          const percentage = storageInfo.totalSize > 0 ? (info.size / storageInfo.totalSize) * 100 : 0;
                          
                          return (
                            <div key={type} className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-primary" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">{type}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {info.count} files
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <Progress value={percentage} className="flex-1 h-2" />
                                  <span className="text-xs text-muted-foreground min-w-fit">
                                    {formatBytes(info.size)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Uploads */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Uploads</CardTitle>
                </CardHeader>
                <CardContent>
                  {storageInfo.recentUploads.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No recent uploads</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {storageInfo.recentUploads.map((upload) => (
                        <div key={upload.id} className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {upload.filename}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatBytes(upload.size)} • {new Date(upload.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="providers" className="space-y-4">
            <div className="grid gap-4">
              {storageInfo.providerUsage.length === 0 ? (
                <Card>
                  <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                    <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="font-medium text-lg mb-2">No providers connected</h3>
                    <p className="text-muted-foreground mb-4 text-center">
                      Connect cloud storage providers to see usage statistics.
                    </p>
                    <Button onClick={() => window.location.href = '/providers'}>
                      Connect Provider
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                storageInfo.providerUsage.map((provider) => {
                  const usagePercent = provider.totalSpace > 0 ? (provider.usedSpace / provider.totalSpace) * 100 : 0;
                  
                  return (
                    <Card key={provider.id}>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                          <CardTitle className="text-lg capitalize">
                            {provider.name.replace('-', ' ')}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {formatBytes(provider.usedSpace)} of {formatBytes(provider.totalSpace)} used
                          </p>
                        </div>
                        <Badge 
                          variant={provider.status === 'connected' ? 'default' : 'secondary'}
                          className={provider.status === 'connected' ? 'bg-green-100 text-green-800' : ''}
                        >
                          {provider.status}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Usage</span>
                            <span>{usagePercent.toFixed(1)}%</span>
                          </div>
                          <Progress value={usagePercent} />
                          {usagePercent > 90 && (
                            <div className="flex items-center gap-2 text-sm text-orange-600">
                              <AlertTriangle className="h-4 w-4" />
                              Storage almost full
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="cleanup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Storage Cleanup</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Free up space by removing unnecessary files
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Button variant="outline" className="h-auto p-4">
                    <div className="flex flex-col items-center gap-2">
                      <Trash2 className="h-6 w-6 text-destructive" />
                      <span className="font-medium">Empty Trash</span>
                      <span className="text-xs text-muted-foreground">
                        Remove deleted files permanently
                      </span>
                    </div>
                  </Button>
                  
                  <Button variant="outline" className="h-auto p-4">
                    <div className="flex flex-col items-center gap-2">
                      <Download className="h-6 w-6 text-primary" />
                      <span className="font-medium">Archive Old Files</span>
                      <span className="text-xs text-muted-foreground">
                        Move old files to cold storage
                      </span>
                    </div>
                  </Button>
                </div>
                
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Storage Optimization Tips</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Consider compressing large files before uploading</li>
                    <li>• Remove duplicate files to save space</li>
                    <li>• Archive files you don't access frequently</li>
                    <li>• Use lower resolution for images when possible</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default StoragePage;
