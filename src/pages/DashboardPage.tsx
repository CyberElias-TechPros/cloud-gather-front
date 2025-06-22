
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StorageOverview } from '@/components/dashboard/StorageOverview';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EnhancedFileGrid } from '@/components/files/EnhancedFileGrid';
import { FileItem } from '@/types/file';
import { UploadDropzone } from '@/components/uploads/UploadDropzone';
import { UploadProgress, UploadItem } from '@/components/uploads/UploadProgress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Upload, Clock, FileText, Upload as UploadIcon, Loader2 } from 'lucide-react';
import { fileOperations } from '@/services/fileOperations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const DashboardPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  
  const [storageData, setStorageData] = useState<{
    totalSpace: number;
    usedSpace: number;
    providers: {
      name: string;
      totalSpace: number;
      usedSpace: number;
      type: string;
    }[];
  }>({
    totalSpace: 0,
    usedSpace: 0,
    providers: []
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Redirect to auth if not authenticated
      window.location.href = '/auth';
      return;
    }
    
    loadDashboardData();
    
    // Set up realtime subscription for file activities
    const channel = supabase
      .channel('public:files')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'files' },
        handleFileActivity
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  const handleFileActivity = (payload: any) => {
    // File activity is now handled by the ActivityFeed component
    // We just need to refresh the recent files
    if (payload.eventType === 'INSERT') {
      loadRecentFiles();
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    
    try {
      // Fetch storage usage
      const storage = await fetchStorageUsage();
      setStorageData(storage);
      
      // Fetch recent files
      const files = await fetchRecentFiles(10);
      setRecentFiles(files);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStorageUsage = async () => {
    try {
      // Get storage providers
      const { data: providers, error } = await supabase
        .from('storage_providers')
        .select('*')
        .eq('user_id', user!.id);
      
      if (error) {
        throw error;
      }
      
      const formattedProviders = providers?.map(provider => ({
        id: provider.id,
        name: provider.provider_name,
        totalSpace: provider.total_space || 0,
        usedSpace: provider.used_space || 0,
        type: 'External'
      })) || [];
      
      // Calculate totals
      const totalSpace = formattedProviders.reduce((acc, provider) => acc + provider.totalSpace, 0);
      const usedSpace = formattedProviders.reduce((acc, provider) => acc + provider.usedSpace, 0);
      
      return {
        totalSpace,
        usedSpace,
        providers: formattedProviders
      };
    } catch (error) {
      console.error('Error fetching storage usage:', error);
      return {
        totalSpace: 0,
        usedSpace: 0,
        providers: []
      };
    }
  };
  
  const fetchRecentFiles = async (limit: number) => {
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', user!.id)
        .order('last_accessed_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw error;
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching recent files:', error);
      return [];
    }
  };

  const loadRecentFiles = async () => {
    try {
      const files = await fetchRecentFiles(10);
      setRecentFiles(files);
    } catch (error) {
      console.error('Error loading recent files:', error);
    }
  };
  
  const handleFilesSelected = async (files: File[]) => {
    const newUploads: UploadItem[] = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploadItems([...newUploads, ...uploadItems]);
    
    // Process each file upload
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const uploadItem = newUploads[i];
      
      try {
        // Upload the file with progress tracking
        const uploadedFile = await fileOperations.uploadFile(
          file, 
          null, 
          null, 
          (progress) => {
            setUploadItems((prevUploads) => {
              return prevUploads.map((item) => {
                if (item.id === uploadItem.id) {
                  return { ...item, progress };
                }
                return item;
              });
            });
          }
        );
        
        if (uploadedFile) {
          // Update recent files
          setRecentFiles((prevFiles) => [uploadedFile, ...prevFiles.slice(0, 9)]);
        }
        
        // Update upload status
        setUploadItems((prevUploads) => {
          return prevUploads.map((item) => {
            if (item.id === uploadItem.id) {
              return { ...item, progress: 100, status: 'success' as const };
            }
            return item;
          });
        });
        
        toast.success(`${file.name} uploaded successfully`);
      } catch (error: any) {
        console.error('Error uploading file:', error);
        
        // Update upload status to error
        setUploadItems((prevUploads) => {
          return prevUploads.map((item) => {
            if (item.id === uploadItem.id) {
              return {
                ...item, 
                status: 'error' as const, 
                error: error.message || 'Upload failed'
              };
            }
            return item;
          });
        });
        
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  };
  
  const handleCancelUpload = (id: string) => {
    setUploadItems((prevUploads) => 
      prevUploads.filter((item) => item.id !== id)
    );
  };
  
  const handleRetryUpload = (id: string) => {
    // In a real implementation, we would need to store the original File object
    // For now, we'll just simulate progress
    setUploadItems((prevUploads) => 
      prevUploads.map((item) => 
        item.id === id ? { ...item, progress: 0, status: 'uploading' as const, error: undefined } : item
      )
    );
    
    const progressInterval = setInterval(() => {
      setUploadItems((prevUploads) => {
        const updatedUploads = prevUploads.map((item) => {
          if (item.id === id) {
            const newProgress = item.progress + 10;
            
            if (newProgress >= 100) {
              clearInterval(progressInterval);
              return { ...item, progress: 100, status: 'success' as const };
            }
            
            return { ...item, progress: newProgress };
          }
          
          return item;
        });
        
        return updatedUploads;
      });
    }, 300);
  };
  
  const handleClearUpload = (id: string) => {
    setUploadItems((prevUploads) => 
      prevUploads.filter((item) => item.id !== id)
    );
  };

  if (authLoading) {
    return (
      <AppLayout title="Dashboard">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Checking authentication...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Dashboard">
      {loading ? (
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading dashboard...</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="md:col-span-2">
              <StorageOverview storageData={storageData} />
            </div>
            <div>
              <ActivityFeed />
            </div>
          </div>
          
          <div className="mb-6">
            <Card>
              <CardContent className="p-6">
                <UploadDropzone onFilesSelected={handleFilesSelected} />
              </CardContent>
            </Card>
          </div>
          
          <UploadProgress 
            uploads={uploadItems}
            onCancel={handleCancelUpload}
            onRetry={handleRetryUpload}
            onClear={handleClearUpload}
          />
          
          <Tabs defaultValue="recent">
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="recent">
                  <Clock className="h-4 w-4 mr-2" />
                  Recent Files
                </TabsTrigger>
                <TabsTrigger value="quick">
                  <FileText className="h-4 w-4 mr-2" />
                  Quick Access
                </TabsTrigger>
              </TabsList>
              
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/files">
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Go to Files
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/providers">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Storage
                  </Link>
                </Button>
              </div>
            </div>
            
            <TabsContent value="recent" className="mt-0">
              <EnhancedFileGrid 
                initialFiles={recentFiles} 
                view="list"
                hideToolbar
                hideBreadcrumb
              />
            </TabsContent>
            
            <TabsContent value="quick" className="mt-0">
              <EnhancedFileGrid 
                initialFiles={recentFiles.filter(f => f.is_starred)} 
                view="list"
                hideToolbar
                hideBreadcrumb
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  );
};

export default DashboardPage;
