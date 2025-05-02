
import React, { useState, useEffect } from 'react';
import { FileItem } from '@/types/file';
import { FileGrid } from '@/components/files/FileGrid';
import { FileToolbar } from '@/components/files/FileToolbar';
import { FileBreadcrumb } from '@/components/files/FileBreadcrumb';
import { FilePreview } from '@/components/files/FilePreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { fileOperations } from '@/services/fileOperations';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ChevronUp, FolderUp } from 'lucide-react';
import { toast } from 'sonner';

interface EnhancedFileGridProps {
  initialFiles?: FileItem[];
  providerId?: string;
  view?: 'grid' | 'list';
  hideToolbar?: boolean;
  hideBreadcrumb?: boolean;
  sortable?: boolean;
}

export const EnhancedFileGrid: React.FC<EnhancedFileGridProps> = ({
  initialFiles,
  providerId,
  view = 'list',
  hideToolbar = false,
  hideBreadcrumb = false,
  sortable = true,
}) => {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>(initialFiles || []);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState<FileItem | null>(null);
  const [currentPath, setCurrentPath] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'date' | 'size'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  
  // Load files when component mounts or folder changes
  useEffect(() => {
    if (!user) return;
    
    loadFiles();
  }, [user, currentFolder, sortField, sortDirection]);

  const loadFiles = async () => {
    setLoading(true);
    
    try {
      const files = await fileOperations.listFiles(
        currentFolder?.id || null,
        providerId || null,
        sortField,
        sortDirection
      );
      
      setFiles(files);
    } catch (error) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      toast.error('Please enter a folder name');
      return;
    }
    
    try {
      await fileOperations.createFolder(folderName, currentFolder?.id || null);
      setCreateFolderOpen(false);
      setFolderName('');
      loadFiles();
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Failed to create folder');
    }
  };

  const handleFileClick = (file: FileItem) => {
    if (file.is_folder) {
      navigateToFolder(file);
    } else {
      setSelectedFile(file);
      setPreviewOpen(true);
    }
  };

  const navigateToFolder = async (folder: FileItem) => {
    setCurrentFolder(folder);
    
    // Update breadcrumb path
    if (folder) {
      setCurrentPath([...currentPath, folder]);
    }
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Navigate to root
      setCurrentFolder(null);
      setCurrentPath([]);
    } else {
      const folder = currentPath[index];
      setCurrentFolder(folder);
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  const navigateUp = () => {
    if (currentPath.length > 0) {
      const newPath = [...currentPath];
      newPath.pop();
      
      if (newPath.length === 0) {
        setCurrentFolder(null);
      } else {
        setCurrentFolder(newPath[newPath.length - 1]);
      }
      
      setCurrentPath(newPath);
    }
  };

  const handleSortChange = (field: 'name' | 'date' | 'size') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Default to desc when changing fields
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleStarFile = async (file: FileItem) => {
    try {
      const newIsStarred = !file.is_starred;
      await fileOperations.starFile(file.id, newIsStarred);
      
      // Update local state
      setFiles(files.map(f => 
        f.id === file.id ? { ...f, is_starred: newIsStarred } : f
      ));
    } catch (error) {
      console.error('Error starring file:', error);
      toast.error('Failed to update star status');
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    try {
      await fileOperations.deleteFile(file);
      
      // Update local state
      setFiles(files.filter(f => f.id !== file.id));
      toast.success(`${file.is_folder ? 'Folder' : 'File'} deleted`);
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-4">
      {!hideBreadcrumb && (
        <div className="flex items-center justify-between">
          <FileBreadcrumb
            path={currentPath}
            onNavigate={navigateToBreadcrumb}
          />
          {currentPath.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={navigateUp}
              className="flex items-center gap-1"
            >
              <FolderUp className="w-4 h-4" />
              <span>Up</span>
            </Button>
          )}
        </div>
      )}
      
      {!hideToolbar && (
        <FileToolbar
          onCreateFolder={() => setCreateFolderOpen(true)}
          onRefresh={loadFiles}
          onSortChange={sortable ? handleSortChange : undefined}
          sortField={sortField}
          sortDirection={sortDirection}
          showUploadButton={true}
          onUploadComplete={loadFiles}
          currentFolderId={currentFolder?.id || null}
          providerId={providerId}
        />
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading files...</span>
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-muted mb-4">
            <FolderUp className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-medium text-lg">No files found</h3>
          <p className="text-muted-foreground mt-1">
            {currentFolder ? 'This folder is empty' : 'Upload files or create folders to get started'}
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={() => setCreateFolderOpen(true)}>Create Folder</Button>
          </div>
        </div>
      ) : (
        <FileGrid
          files={files}
          view={view}
          onFileClick={handleFileClick}
          onStarClick={handleStarFile}
          onDeleteClick={handleDeleteFile}
        />
      )}
      
      {selectedFile && (
        <FilePreview
          file={selectedFile}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      )}
      
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateFolder();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder}>Create Folder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
