
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  ChevronDown, 
  Filter, 
  FolderPlus, 
  Grid, 
  List, 
  Search, 
  SortAsc, 
  Upload 
} from 'lucide-react';
import { UploadDropzone } from '@/components/uploads/UploadDropzone';

interface FileToolbarProps {
  view: 'grid' | 'list';
  onViewChange: (view: 'grid' | 'list') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'name' | 'date' | 'size';
  sortDirection: 'asc' | 'desc';
  onSort: (sortBy: 'name' | 'date' | 'size') => void;
  uploadDialogOpen: boolean;
  setUploadDialogOpen: (open: boolean) => void;
  newFolderDialogOpen: boolean;
  setNewFolderDialogOpen: (open: boolean) => void;
  newFolderName: string;
  setNewFolderName: (name: string) => void;
  onCreateFolder: () => void;
  onFilesSelected: (files: File[]) => void;
}

export const FileToolbar = ({
  view,
  onViewChange,
  searchQuery,
  onSearchChange,
  sortBy,
  sortDirection,
  onSort,
  uploadDialogOpen,
  setUploadDialogOpen,
  newFolderDialogOpen,
  setNewFolderDialogOpen,
  newFolderName,
  setNewFolderName,
  onCreateFolder,
  onFilesSelected
}: FileToolbarProps) => {
  
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
      <div className="w-full md:w-auto flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search files and folders..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      
      <div className="flex items-center gap-2 w-full md:w-auto">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onViewChange(view === 'grid' ? 'list' : 'grid')}
        >
          {view === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SortAsc className="h-4 w-4 mr-2" />
              Sort
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onSort('name')}>
              By Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort('date')}>
              By Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort('size')}>
              By Size {sortBy === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>All Files</DropdownMenuItem>
            <DropdownMenuItem>Documents</DropdownMenuItem>
            <DropdownMenuItem>Images</DropdownMenuItem>
            <DropdownMenuItem>Videos</DropdownMenuItem>
            <DropdownMenuItem>Audio</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Files</DialogTitle>
            </DialogHeader>
            <UploadDropzone onFilesSelected={onFilesSelected} />
          </DialogContent>
        </Dialog>
        
        <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="my-4"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={onCreateFolder}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
