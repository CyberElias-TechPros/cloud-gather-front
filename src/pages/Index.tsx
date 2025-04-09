
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StorageOverview } from '@/components/dashboard/StorageOverview';
import { ActivityFeed, ActivityItem } from '@/components/dashboard/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileGrid } from '@/components/files/FileGrid';
import { FileItem } from '@/components/files/FileCard';
import { UploadDropzone } from '@/components/uploads/UploadDropzone';
import { UploadProgress, UploadItem } from '@/components/uploads/UploadProgress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Upload, Clock, FileText, Upload as UploadIcon, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getRecentFiles, getStorageUsage, uploadFile } from '@/services/cloudProviders';
import { toast } from 'sonner';

const Dashboard = () => {
  const { user } = useAuth();
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
  
  // Sample activity data - in a real implementation this would come from the database
  const recentActivities: ActivityItem[] = [
    {
      id: '1',
      type: 'upload',
      fileName: 'Project Presentation.pptx',
      timestamp: new Date(Date.now() - 1000 * 60 * 30) // 30 minutes ago
    },
    {
      id: '2',
      type: 'share',
      fileName: 'Budget 2023.xlsx',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2) // 2 hours ago
    },
    {
      id: '3',
      type: 'edit',
      fileName: 'Meeting Notes.docx',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5) // 5 hours ago
    },
    {
      id: '4',
      type: 'download',
      fileName: 'Company Logo.png',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
    }
  ];
  
  useEffect(() => {
    if (!user) return;
    
    const loadDashboardData = async () => {
      setLoading(true);
      
      try {
        // Fetch storage usage
        const storage = await getStorageUsage();
        setStorageData(storage);
        
        // Fetch recent files
        const files = await getRecentFiles(10);
        setRecentFiles(files);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
        toast.error('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    
    loadDashboardData();
  }, [user]);
  
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
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadItems((prevUploads) => {
          return prevUploads.map((item) => {
            if (item.id === uploadItem.id) {
              const newProgress = Math.min(95, item.progress + 5); // Cap at 95% until really done
              return { ...item, progress: newProgress };
            }
            return item;
          });
        });
      }, 200);
      
      try {
        // Upload the file
        const uploadedFile = await uploadFile(file);
        
        // Update recent files if needed
        setRecentFiles((prevFiles) => [uploadedFile, ...prevFiles.slice(0, 9)]);
        
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
      } catch (error) {
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
      } finally {
        clearInterval(progressInterval);
      }
    }
  };
  
  const handleCancelUpload = (id: string) => {
    setUploadItems((prevUploads) => 
      prevUploads.filter((item) => item.id !== id)
    );
  };
  
  const handleRetryUpload = (id: string) => {
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
              <ActivityFeed activities={recentActivities} />
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
                <Button variant="outline" size="sm">
                  <UploadIcon className="h-4 w-4 mr-2" />
                  Upload Files
                </Button>
                <Button size="sm">
                  <PlusCircle className="h-4 w-4 mr-2" />
                  New Folder
                </Button>
              </div>
            </div>
            
            <TabsContent value="recent" className="mt-0">
              <FileGrid files={recentFiles} view="list" />
            </TabsContent>
            
            <TabsContent value="quick" className="mt-0">
              <FileGrid files={recentFiles.slice(0, 2)} view="list" />
            </TabsContent>
          </Tabs>
        </>
      )}
    </AppLayout>
  );
};

export default Dashboard;
