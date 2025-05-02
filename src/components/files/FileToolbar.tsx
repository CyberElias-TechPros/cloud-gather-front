
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  FolderPlus,
  Upload,
  RefreshCw,
  Grid,
  List,
  SortAsc,
  SortDesc,
  Clock,
  FileText,
  ArrowUpDown,
} from 'lucide-react';
import { toast } from 'sonner';

export interface FileToolbarProps {
  onCreateFolder?: () => void;
  onRefresh?: () => void;
  onSortChange?: (field: 'name' | 'date' | 'size') => void;
  onViewChange?: (view: 'grid' | 'list') => void;
  sortField?: 'name' | 'date' | 'size';
  sortDirection?: 'asc' | 'desc';
  view?: 'grid' | 'list';
  showUploadButton?: boolean;
  onUploadComplete?: () => void;
  currentFolderId?: string | null;
  providerId?: string | null;
}

export const FileToolbar = ({
  onCreateFolder,
  onRefresh,
  onSortChange,
  onViewChange,
  sortField = 'date',
  sortDirection = 'desc',
  view = 'list',
  showUploadButton = true,
  onUploadComplete,
  currentFolderId,
  providerId,
}: FileToolbarProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    
    if (!files || files.length === 0) return;
    
    setUploading(true);
    
    try {
      // Handle file upload (implementation depends on your fileOperations service)
      // For now, just show a toast message
      toast.success(`${files.length} file(s) uploaded`);
      
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex justify-between items-center py-2">
      <div className="flex gap-2">
        <Button 
          variant="secondary" 
          size="sm"
          onClick={onCreateFolder}
          disabled={uploading}
        >
          <FolderPlus className="h-4 w-4 mr-1" />
          New Folder
        </Button>
        
        {showUploadButton && (
          <>
            <Button 
              variant="default" 
              size="sm"
              onClick={handleUploadClick}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? 'Uploading...' : 'Upload Files'}
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
            />
          </>
        )}
      </div>
      
      <div className="flex gap-2">
        {onRefresh && (
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onRefresh}
            disabled={uploading}
          >
            <RefreshCw className="h-4 w-4" />
            <span className="sr-only">Refresh</span>
          </Button>
        )}
        
        {onViewChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                {view === 'grid' ? (
                  <Grid className="h-4 w-4" />
                ) : (
                  <List className="h-4 w-4" />
                )}
                <span className="sr-only">Change view</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewChange('grid')}>
                <Grid className="h-4 w-4 mr-2" />
                Grid view
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewChange('list')}>
                <List className="h-4 w-4 mr-2" />
                List view
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <ArrowUpDown className="h-4 w-4" />
                <span className="sr-only">Sort</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSortChange('name')}>
                <FileText className="h-4 w-4 mr-2" />
                Name
                {sortField === 'name' && (
                  sortDirection === 'asc' ? (
                    <SortAsc className="h-4 w-4 ml-2" />
                  ) : (
                    <SortDesc className="h-4 w-4 ml-2" />
                  )
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('date')}>
                <Clock className="h-4 w-4 mr-2" />
                Date
                {sortField === 'date' && (
                  sortDirection === 'asc' ? (
                    <SortAsc className="h-4 w-4 ml-2" />
                  ) : (
                    <SortDesc className="h-4 w-4 ml-2" />
                  )
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange('size')}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Size
                {sortField === 'size' && (
                  sortDirection === 'asc' ? (
                    <SortAsc className="h-4 w-4 ml-2" />
                  ) : (
                    <SortDesc className="h-4 w-4 ml-2" />
                  )
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
