import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileGrid } from '@/components/files/FileGrid';
import { FileItem } from '@/components/files/FileCard';
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { 
  ChevronDown, 
  Filter, 
  FolderPlus, 
  Grid, 
  List, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  SortAsc, 
  Upload 
} from 'lucide-react';
import { UploadDropzone } from '@/components/uploads/UploadDropzone';
import { UploadProgress, UploadItem } from '@/components/uploads/UploadProgress';

const FilesPage = () => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState<string[]>(['My Files']);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  
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
  
  const handleFileOpen = (file: FileItem) => {
    if (file.isFolder) {
      setCurrentPath([...currentPath, file.name]);
    } else {
      console.log('Opening file:', file.name);
    }
  };
  
  const handleNavigatePath = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };
  
  const handleSort = (newSortBy: 'name' | 'date' | 'size') => {
    if (sortBy === newSortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortDirection('asc');
    }
  };
  
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
  
  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      console.log('Creating folder:', newFolderName);
      setNewFolderName('');
      setNewFolderDialogOpen(false);
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
    <AppLayout title="My Files">
      <div className="mb-6">
        <Breadcrumb>
          {currentPath.map((path, index) => (
            <React.Fragment key={path}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => handleNavigatePath(index)}
                  className="cursor-pointer"
                >
                  {path}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </Breadcrumb>
      </div>
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="w-full md:w-auto flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files and folders..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button variant="outline" size="sm" onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
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
              <DropdownMenuItem onClick={() => handleSort('name')}>
                By Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('date')}>
                By Date {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleSort('size')}>
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
              <UploadDropzone onFilesSelected={handleFilesSelected} />
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
                <Button onClick={handleCreateFolder}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <UploadProgress 
        uploads={uploadItems}
        onCancel={handleCancelUpload}
        onRetry={handleRetryUpload}
        onClear={handleClearUpload}
      />
      
      <FileGrid 
        files={sortedFiles} 
        view={view} 
        onFileOpen={handleFileOpen}
      />
    </AppLayout>
  );
};

export default FilesPage;
