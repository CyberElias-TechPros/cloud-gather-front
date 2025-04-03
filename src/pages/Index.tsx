import React, { useState } from 'react';
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
import { PlusCircle, Upload, Clock, FileText, Upload as UploadIcon } from 'lucide-react';

const Dashboard = () => {
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  
  const storageData = {
    totalSpace: 30 * 1024 * 1024 * 1024, // 30GB
    usedSpace: 20 * 1024 * 1024 * 1024, // 20GB
    providers: [
      {
        name: 'Google Drive',
        totalSpace: 15 * 1024 * 1024 * 1024, // 15GB
        usedSpace: 12 * 1024 * 1024 * 1024, // 12GB
        type: 'Personal'
      },
      {
        name: 'Dropbox',
        totalSpace: 10 * 1024 * 1024 * 1024, // 10GB
        usedSpace: 6 * 1024 * 1024 * 1024, // 6GB
        type: 'Business'
      },
      {
        name: 'OneDrive',
        totalSpace: 5 * 1024 * 1024 * 1024, // 5GB
        usedSpace: 2 * 1024 * 1024 * 1024, // 2GB
        type: 'Personal'
      }
    ]
  };
  
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
  
  const recentFiles: FileItem[] = [
    {
      id: '1',
      name: 'Project Presentation.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: 2.5 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 30),
      provider: 'Google Drive'
    },
    {
      id: '2',
      name: 'Budget 2023.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1.8 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 2),
      provider: 'Dropbox'
    },
    {
      id: '3',
      name: 'Meeting Notes.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: 350 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 5),
      provider: 'OneDrive'
    },
    {
      id: '4',
      name: 'Company Logo.png',
      type: 'image/png',
      size: 1.2 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24),
      provider: 'Google Drive'
    }
  ];
  
  const handleFilesSelected = (files: File[]) => {
    const newUploads: UploadItem[] = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploadItems([...newUploads, ...uploadItems]);
    
    newUploads.forEach((upload) => {
      const intervalId = setInterval(() => {
        setUploadItems((prevUploads) => {
          const updatedUploads = prevUploads.map((item) => {
            if (item.id === upload.id) {
              const newProgress = item.progress + 10;
              
              if (newProgress >= 100) {
                clearInterval(intervalId);
                return { ...item, progress: 100, status: 'success' as const };
              }
              
              return { ...item, progress: newProgress };
            }
            
            return item;
          });
          
          return updatedUploads;
        });
      }, 500);
    });
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
    
    const intervalId = setInterval(() => {
      setUploadItems((prevUploads) => {
        const updatedUploads = prevUploads.map((item) => {
          if (item.id === id) {
            const newProgress = item.progress + 10;
            
            if (newProgress >= 100) {
              clearInterval(intervalId);
              return { ...item, progress: 100, status: 'success' as const };
            }
            
            return { ...item, progress: newProgress };
          }
          
          return item;
        });
        
        return updatedUploads;
      });
    }, 500);
  };
  
  const handleClearUpload = (id: string) => {
    setUploadItems((prevUploads) => 
      prevUploads.filter((item) => item.id !== id)
    );
  };

  return (
    <AppLayout title="Dashboard">
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
    </AppLayout>
  );
};

export default Dashboard;
