
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileGrid } from '@/components/files/FileGrid';
import { FileItem } from '@/components/files/FileCard';
import { UploadProgress, UploadItem } from '@/components/uploads/UploadProgress';
import { FileOperationsDrawer } from '@/components/files/FileOperationsDrawer';
import { FileToolbar } from '@/components/files/FileToolbar';
import { FileBreadcrumb } from '@/components/files/FileBreadcrumb';
import { DeleteFileDialog } from '@/components/files/DeleteFileDialog';
import { toast } from 'sonner';
import { 
  getFiles, 
  createFolder, 
  uploadFile, 
  deleteFile,
  renameFile,
  shareFile,
  starFile
} from '@/services/cloudProviders';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const FilesPage = () => {
  const { user } = useAuth();
  
  // View state
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [currentPath, setCurrentPath] = useState<string[]>(['My Files']);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  // Data state
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  // Fetch files when folder changes
  useEffect(() => {
    if (!user) return;
    
    const loadFiles = async () => {
      setLoading(true);
      try {
        const filesData = await getFiles(currentFolderId, sortBy, sortDirection);
        setFiles(filesData);
      } catch (error) {
        console.error('Error loading files:', error);
        toast.error('Failed to load files');
      } finally {
        setLoading(false);
      }
    };
    
    loadFiles();
  }, [currentFolderId, sortBy, sortDirection, user]);
  
  // Navigation handlers
  const handleFileOpen = async (file: FileItem) => {
    if (file.is_folder) {
      setCurrentPath([...currentPath, file.filename]);
      setCurrentFolderId(file.id);
    } else {
      // If it's stored in Supabase Storage
      if (file.provider_file_id && !file.provider_id) {
        try {
          // Download from Supabase Storage
          const { data, error } = await supabase
            .storage
            .from('user_uploads')
            .download(file.provider_file_id);
            
          if (error) throw error;
          
          // Create a download link
          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.filename;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(url);
          document.body.removeChild(a);
          
          toast.success('File downloaded successfully');
        } catch (error) {
          console.error('Error downloading file:', error);
          toast.error('Failed to download file');
        }
      } else {
        toast.info('Opening file from cloud storage provider');
        // In a real implementation, this would open the file from the provider
      }
    }
  };
  
  const handleNavigatePath = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
    
    if (index === 0) {
      // Root level
      setCurrentFolderId(null);
    } else {
      // We would need to have a mapping of path segments to folder IDs
      // This is simplified for the demo - in real implementation would need path traversal
    }
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
  const handleFilesSelected = async (selectedFiles: File[]) => {
    const newUploads: UploadItem[] = selectedFiles.map((file, index) => ({
      id: `upload-${Date.now()}-${index}`,
      fileName: file.name,
      size: file.size,
      progress: 0,
      status: 'uploading' as const
    }));
    
    setUploadItems([...newUploads, ...uploadItems]);
    setUploadDialogOpen(false);
    
    // Process each file
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
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
        const uploadedFile = await uploadFile(file, currentFolderId);
        
        // Add to files list
        setFiles((prevFiles) => [...prevFiles, uploadedFile]);
        
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
    // In a real implementation, would need to abort the fetch/xhr
    setUploadItems((prevUploads) => 
      prevUploads.filter((item) => item.id !== id)
    );
  };
  
  const handleRetryUpload = (id: string) => {
    // Find the upload item
    const uploadItem = uploadItems.find((item) => item.id === id);
    if (!uploadItem) return;
    
    setUploadItems((prevUploads) => 
      prevUploads.map((item) => 
        item.id === id ? { ...item, progress: 0, status: 'uploading' as const, error: undefined } : item
      )
    );
    
    // In a real implementation, we would need to re-upload the file
    // For this demo, we'll just simulate progress
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
    }, 500);
  };
  
  const handleClearUpload = (id: string) => {
    setUploadItems((prevUploads) => 
      prevUploads.filter((item) => item.id !== id)
    );
  };
  
  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      try {
        const folder = await createFolder(newFolderName, currentFolderId);
        setFiles((prevFiles) => [...prevFiles, folder]);
        setNewFolderName('');
        setNewFolderDialogOpen(false);
        toast.success(`Folder "${newFolderName}" created successfully`);
      } catch (error) {
        console.error('Error creating folder:', error);
        toast.error('Failed to create folder');
      }
    }
  };

  // File operation handlers
  const handleFileDownload = (file: FileItem) => {
    // Similar to handleFileOpen for files
    toast.info(`Downloading ${file.filename}`);
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
    toast.info(`Copying ${file.filename} to clipboard`);
  };

  const handleFileMove = (file: FileItem) => {
    toast.info(`Please select a destination for ${file.filename}`);
  };

  const handleFileDetails = (file: FileItem) => {
    setActiveFile(file);
    setActiveOperation('details');
  };

  const handleConfirmDelete = async () => {
    if (activeFile) {
      try {
        await deleteFile(activeFile.id);
        setFiles((prevFiles) => prevFiles.filter(file => file.id !== activeFile.id));
        toast.success(`${activeFile.filename} has been deleted`);
      } catch (error) {
        console.error('Error deleting file:', error);
        toast.error('Failed to delete file');
      } finally {
        setActiveFile(null);
        setDeleteDialogOpen(false);
      }
    }
  };

  const handleConfirmRename = async (file: FileItem, newName: string) => {
    try {
      await renameFile(file.id, newName);
      // Update the file in the list
      setFiles((prevFiles) => prevFiles.map(f => {
        if (f.id === file.id) {
          return { ...f, filename: newName };
        }
        return f;
      }));
      toast.success('File renamed successfully');
    } catch (error) {
      console.error('Error renaming file:', error);
      toast.error('Failed to rename file');
    } finally {
      setActiveOperation(null);
      setActiveFile(null);
    }
  };

  const handleConfirmShare = async (file: FileItem, shareSettings: { email: string, permission: 'view' | 'edit' | 'admin' }) => {
    try {
      await shareFile(file.id, shareSettings.email, shareSettings.permission);
      toast.success('File shared successfully');
    } catch (error) {
      console.error('Error sharing file:', error);
      toast.error('Failed to share file');
    } finally {
      setActiveOperation(null);
      setActiveFile(null);
    }
  };

  const closeOperationDrawer = () => {
    setActiveOperation(null);
    setActiveFile(null);
  };

  // Filter files based on search
  const filteredFiles = searchQuery.trim() ? 
    files.filter(file => file.filename.toLowerCase().includes(searchQuery.toLowerCase())) : 
    files;

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
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading files...</span>
        </div>
      ) : (
        <FileGrid 
          files={filteredFiles} 
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
      )}

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
