
import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileGrid } from '@/components/files/FileGrid';
import { FileItem } from '@/components/files/FileCard';
import { UploadProgress, UploadItem } from '@/components/uploads/UploadProgress';
import { FileOperationsDrawer } from '@/components/files/FileOperationsDrawer';
import { FileToolbar } from '@/components/files/FileToolbar';
import { FileBreadcrumb } from '@/components/files/FileBreadcrumb';
import { DeleteFileDialog } from '@/components/files/DeleteFileDialog';
import { toast } from '@/hooks/use-toast';

const FilesPage = () => {
  // View state
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [currentPath, setCurrentPath] = useState<string[]>(['My Files']);
  
  // Dialog states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Search and sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Form states
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  
  // Active file operation states
  const [activeFile, setActiveFile] = useState<FileItem | null>(null);
  const [activeOperation, setActiveOperation] = useState<'rename' | 'share' | 'details' | null>(null);
  
  // Sample files data
  const files: FileItem[] = [
    {
      id: '1',
      name: 'Documents',
      type: 'folder',
      size: 0,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      isFolder: true
    },
    {
      id: '2',
      name: 'Images',
      type: 'folder',
      size: 0,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
      isFolder: true
    },
    {
      id: '3',
      name: 'Project Files',
      type: 'folder',
      size: 0,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      isFolder: true
    },
    {
      id: '4',
      name: 'Annual Report 2023.pdf',
      type: 'application/pdf',
      size: 3.5 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
      provider: 'Google Drive'
    },
    {
      id: '5',
      name: 'Product Presentation.pptx',
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      size: 5.2 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      provider: 'OneDrive'
    },
    {
      id: '6',
      name: 'Budget Plan.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size: 1.8 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      provider: 'Dropbox'
    },
    {
      id: '7',
      name: 'Team Photo.jpg',
      type: 'image/jpeg',
      size: 2.7 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 10), // 10 hours ago
      provider: 'Google Drive'
    },
    {
      id: '8',
      name: 'Project Roadmap.pdf',
      type: 'application/pdf',
      size: 1.2 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      provider: 'OneDrive'
    },
    {
      id: '9',
      name: 'Company Logo.png',
      type: 'image/png',
      size: 850 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
      provider: 'Dropbox'
    },
    {
      id: '10',
      name: 'Product Demo.mp4',
      type: 'video/mp4',
      size: 15.7 * 1024 * 1024,
      modified: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      provider: 'Google Drive'
    }
  ];
  
  // Filtered and sorted files
  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    } else if (sortBy === 'date') {
      return sortDirection === 'asc' 
        ? a.modified.getTime() - b.modified.getTime() 
        : b.modified.getTime() - a.modified.getTime();
    } else if (sortBy === 'size') {
      return sortDirection === 'asc' 
        ? a.size - b.size 
        : b.size - a.size;
    }
    return 0;
  });
  
  // Navigation handlers
  const handleFileOpen = (file: FileItem) => {
    if (file.isFolder) {
      setCurrentPath([...currentPath, file.name]);
    } else {
      console.log('Opening file:', file.name);
      toast({
        title: 'Opening file',
        description: `Opening ${file.name}`,
      });
    }
  };
  
  const handleNavigatePath = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };
  
  // Sort handler
  const handleSort = (newSortBy: 'name' | 'date' | 'size') => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };
  
  // File upload handlers
  const handleFilesSelected = (files: File[]) => {
    const newUploads: UploadItem[] = files.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploadItems([...newUploads, ...uploadItems]);
    setUploadDialogOpen(false);
    
    // Simulate upload progress
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
    
    // Simulate upload progress
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
  
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      console.log('Creating folder:', newFolderName);
      toast({
        title: 'Folder created',
        description: `Folder "${newFolderName}" created successfully`,
      });
      setNewFolderName('');
      setNewFolderDialogOpen(false);
    }
  };

  // File operation handlers
  const handleFileDownload = (file: FileItem) => {
    toast({
      title: 'Downloading file',
      description: `Downloading ${file.name}`,
    });
  };

  const handleFileShare = (file: FileItem) => {
    setActiveFile(file);
    setActiveOperation('share');
  };

  const handleFileRename = (file: FileItem) => {
    setActiveFile(file);
    setActiveOperation('rename');
  };

  const handleFileDelete = (file: FileItem) => {
    setActiveFile(file);
    setDeleteDialogOpen(true);
  };

  const handleFileCopy = (file: FileItem) => {
    toast({
      title: 'Copy file',
      description: `Copying ${file.name} to clipboard`,
    });
  };

  const handleFileMove = (file: FileItem) => {
    toast({
      title: 'Move file',
      description: `Please select a destination for ${file.name}`,
    });
  };

  const handleFileDetails = (file: FileItem) => {
    setActiveFile(file);
    setActiveOperation('details');
  };

  const handleConfirmDelete = () => {
    if (activeFile) {
      toast({
        title: 'File deleted',
        description: `${activeFile.name} has been deleted`,
      });
      setActiveFile(null);
      setDeleteDialogOpen(false);
    }
  };

  const handleConfirmRename = (file: FileItem, newName: string) => {
    toast({
      title: 'File renamed',
      description: `Renamed to ${newName}`,
    });
  };

  const handleConfirmShare = (file: FileItem, shareSettings: any) => {
    toast({
      title: 'Share settings updated',
      description: `Share settings for ${file.name} updated`,
    });
  };

  const closeOperationDrawer = () => {
    setActiveOperation(null);
    setActiveFile(null);
  };

  return (
    <AppLayout title="My Files">
      {/* Breadcrumb Navigation */}
      <FileBreadcrumb 
        currentPath={currentPath} 
        onNavigate={handleNavigatePath}
      />
      
      {/* File Toolbar */}
      <FileToolbar 
        view={view}
        onViewChange={setView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSort={handleSort}
        uploadDialogOpen={uploadDialogOpen}
        setUploadDialogOpen={setUploadDialogOpen}
        newFolderDialogOpen={newFolderDialogOpen}
        setNewFolderDialogOpen={setNewFolderDialogOpen}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        onCreateFolder={handleCreateFolder}
        onFilesSelected={handleFilesSelected}
      />
      
      {/* Upload Progress */}
      <UploadProgress 
        uploads={uploadItems}
        onCancel={handleCancelUpload}
        onRetry={handleRetryUpload}
        onClear={handleClearUpload}
      />
      
      {/* File Grid */}
      <FileGrid 
        files={sortedFiles} 
        view={view} 
        onFileOpen={handleFileOpen}
        onFileDownload={handleFileDownload}
        onFileShare={handleFileShare}
        onFileRename={handleFileRename}
        onFileDelete={handleFileDelete}
        onFileCopy={handleFileCopy}
        onFileMove={handleFileMove}
        onFileDetails={handleFileDetails}
      />

      {/* File Operations UI */}
      <FileOperationsDrawer
        file={activeFile}
        operation={activeOperation}
        onClose={closeOperationDrawer}
        onRename={handleConfirmRename}
        onShare={handleConfirmShare}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteFileDialog
        file={activeFile}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
      />
    </AppLayout>
  );
};

export default FilesPage;
