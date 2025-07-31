
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileItem } from '@/types/file';
import { enhancedFileOperations } from '@/services/enhancedFileOperations';
import { useMonitoring } from '@/hooks/useMonitoring';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useConfirm } from '@/hooks/useConfirm';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Upload,
  FolderPlus,
  Search,
  MoreVertical,
  Download,
  Share2,
  Star,
  Trash2,
  Edit3,
  Copy,
  Move,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Filter,
} from 'lucide-react';

interface EnhancedFileGridProps {
  initialFiles?: FileItem[];
  view?: 'grid' | 'list';
  parentFolderId?: string | null;
  providerId?: string | null;
  showToolbar?: boolean;
  selectable?: boolean;
  onFileSelect?: (files: FileItem[]) => void;
}

export const EnhancedFileGrid: React.FC<EnhancedFileGridProps> = ({
  initialFiles = [],
  view = 'list',
  parentFolderId = null,
  providerId = null,
  showToolbar = true,
  selectable = false,
  onFileSelect,
}) => {
  const [files, setFiles] = useState<FileItem[]>(initialFiles);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState(view);

  const { recordActivity, measurePerformance } = useMonitoring();
  const { handleAsyncError } = useErrorHandler();
  const confirm = useConfirm();

  // Load files
  const loadFiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await handleAsyncError(
      () => measurePerformance('load_files', () =>
        enhancedFileOperations.listFiles(parentFolderId, providerId, sortBy, sortDirection)
      ),
      { operation: 'loadFiles', parentFolderId, providerId }
    );

    if (data) {
      setFiles(data);
      recordActivity('files_loaded', 'file', undefined, true);
    }
    setLoading(false);
  }, [parentFolderId, providerId, sortBy, sortDirection, handleAsyncError, measurePerformance, recordActivity]);

  // Initial load
  useEffect(() => {
    if (initialFiles.length === 0) {
      loadFiles();
    }
  }, [loadFiles, initialFiles.length]);

  // Update files when initialFiles changes
  useEffect(() => {
    if (initialFiles.length > 0) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    
    const query = searchQuery.toLowerCase();
    return files.filter(file =>
      file.filename.toLowerCase().includes(query) ||
      file.mime_type?.toLowerCase().includes(query)
    );
  }, [files, searchQuery]);

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const uploadPromises = Array.from(fileList).map(async (file) => {
      const { data, error } = await handleAsyncError(
        () => enhancedFileOperations.uploadFile(
          file,
          parentFolderId,
          providerId,
          (progress) => {
            toast.loading(`Uploading ${file.name}: ${progress.progress}%`, {
              id: progress.fileId,
            });
          }
        ),
        { operation: 'uploadFile', fileName: file.name }
      );

      if (data) {
        recordActivity('file_uploaded', 'file', data.id, true);
        toast.success(`${file.name} uploaded successfully`, {
          id: `upload_${file.name}`,
        });
        return data;
      }
      return null;
    });

    const uploadedFiles = (await Promise.all(uploadPromises)).filter(Boolean) as FileItem[];
    
    if (uploadedFiles.length > 0) {
      setFiles(prev => [...uploadedFiles, ...prev]);
    }

    // Clear input
    event.target.value = '';
  }, [parentFolderId, providerId, handleAsyncError, recordActivity]);

  // Handle folder creation
  const handleCreateFolder = useCallback(async () => {
    const name = prompt('Enter folder name:');
    if (!name || !name.trim()) return;

    const { data, error } = await handleAsyncError(
      () => enhancedFileOperations.createFolder(name.trim(), parentFolderId),
      { operation: 'createFolder', folderName: name }
    );

    if (data) {
      setFiles(prev => [data, ...prev]);
      recordActivity('folder_created', 'folder', data.id, true);
    }
  }, [parentFolderId, handleAsyncError, recordActivity]);

  // Handle file deletion
  const handleDeleteFiles = useCallback(async (fileIds: string[]) => {
    const filesToDelete = files.filter(file => fileIds.includes(file.id));
    
    const confirmed = await confirm.confirm({
      title: `Delete ${filesToDelete.length} item${filesToDelete.length > 1 ? 's' : ''}?`,
      description: `This action cannot be undone. ${filesToDelete.length === 1 
        ? `"${filesToDelete[0].filename}" will be permanently deleted.`
        : `${filesToDelete.length} items will be permanently deleted.`
      }`,
      confirmText: 'Delete',
      variant: 'destructive',
    });

    if (!confirmed) return;

    const deletePromises = filesToDelete.map(async (file) => {
      const { error } = await handleAsyncError(
        () => enhancedFileOperations.deleteFile(file),
        { operation: 'deleteFile', fileId: file.id, fileName: file.filename }
      );

      if (!error) {
        recordActivity('file_deleted', file.is_folder ? 'folder' : 'file', file.id, true);
        return file.id;
      }
      return null;
    });

    const deletedFileIds = (await Promise.all(deletePromises)).filter(Boolean) as string[];
    
    if (deletedFileIds.length > 0) {
      setFiles(prev => prev.filter(file => !deletedFileIds.includes(file.id)));
      setSelectedFiles(prev => {
        const newSet = new Set(prev);
        deletedFileIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  }, [files, confirm, handleAsyncError, recordActivity]);

  // Handle file download
  const handleDownloadFile = useCallback(async (file: FileItem) => {
    if (file.is_folder) return;

    const { data, error } = await handleAsyncError(
      () => enhancedFileOperations.getFileContent(file.id),
      { operation: 'downloadFile', fileId: file.id, fileName: file.filename }
    );

    if (data) {
      // Create download link
      const url = URL.createObjectURL(data.content);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      recordActivity('file_downloaded', 'file', file.id, true);
    }
  }, [handleAsyncError, recordActivity]);

  // Handle file selection
  const handleFileSelect = useCallback((fileId: string, selected: boolean) => {
    if (!selectable) return;

    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(fileId);
      } else {
        newSet.delete(fileId);
      }
      
      const selectedFileItems = files.filter(file => newSet.has(file.id));
      onFileSelect?.(selectedFileItems);
      
      return newSet;
    });
  }, [selectable, files, onFileSelect]);

  // Handle sort change
  const handleSortChange = useCallback((newSortBy: typeof sortBy) => {
    if (newSortBy === sortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('desc');
    }
  }, [sortBy]);

  const renderFileItem = useCallback((file: FileItem) => {
    const isSelected = selectedFiles.has(file.id);
    
    return (
      <div
        key={file.id}
        className={`
          group relative p-4 rounded-lg border transition-all duration-200
          ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'}
          ${selectable ? 'cursor-pointer' : ''}
        `}
        onClick={() => handleFileSelect(file.id, !isSelected)}
      >
        <div className="flex items-center space-x-3">
          {selectable && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => handleFileSelect(file.id, e.target.checked)}
              className="rounded border-gray-300"
            />
          )}
          
          <div className="flex-shrink-0">
            {file.is_folder ? (
              <FolderPlus className="h-8 w-8 text-blue-500" />
            ) : (
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {file.filename.split('.').pop()?.toUpperCase() || 'FILE'}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {file.filename}
            </p>
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span>{new Date(file.updated_at).toLocaleDateString()}</span>
              {!file.is_folder && file.size && (
                <span>{formatFileSize(file.size)}</span>
              )}
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!file.is_folder && (
                <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </DropdownMenuItem>
              )}
              <DropdownMenuItem>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Star className="h-4 w-4 mr-2" />
                {file.is_starred ? 'Remove from favorites' : 'Add to favorites'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Edit3 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Move className="h-4 w-4 mr-2" />
                Move
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => handleDeleteFiles([file.id])}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  }, [selectedFiles, selectable, handleFileSelect, handleDownloadFile, handleDeleteFiles]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" text="Loading files..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showToolbar && (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Sort
                  {sortDirection === 'asc' ? 
                    <SortAsc className="h-4 w-4 ml-1" /> : 
                    <SortDesc className="h-4 w-4 ml-1" />
                  }
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSortChange('name')}>
                  Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange('date')}>
                  Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange('size')}>
                  Size {sortBy === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button onClick={handleCreateFolder} size="sm">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
            
            <label htmlFor="file-upload">
              <Button asChild size="sm">
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </span>
              </Button>
            </label>
            <input
              id="file-upload"
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      )}

      {selectedFiles.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedFiles.size} item{selectedFiles.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedFiles(new Set())}
            >
              Clear selection
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleDeleteFiles(Array.from(selectedFiles))}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {filteredFiles.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {searchQuery ? `No files found matching "${searchQuery}"` : 'No files found'}
          </div>
        </div>
      ) : (
        <div className={`
          ${viewMode === 'grid' 
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
          }
        `}>
          {filteredFiles.map(renderFileItem)}
        </div>
      )}

      <ConfirmDialog
        open={confirm.isOpen}
        onOpenChange={confirm.setIsOpen}
        title={confirm.options.title}
        description={confirm.options.description}
        confirmText={confirm.options.confirmText}
        cancelText={confirm.options.cancelText}
        variant={confirm.options.variant}
        onConfirm={confirm.handleConfirm}
      />
    </div>
  );
};

// Utility function to format file sizes
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
