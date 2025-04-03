
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileGrid } from '@/components/files/FileGrid';
import { 
  Grid, 
  LayoutList, 
  MoreHorizontal, 
  Search, 
  SlidersHorizontal, 
  Star 
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const StarredPage = () => {
  const [files, setFiles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = React.useState('name');
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <AppLayout title="Starred">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">Starred Files</h2>
          
          <div className="flex flex-1 md:flex-none items-center gap-2">
            <div className="flex items-center w-full md:w-auto bg-muted rounded-md px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground mr-2" />
              <Input 
                type="text" 
                placeholder="Search starred files..." 
                className="border-0 bg-transparent focus-visible:ring-0 h-8 p-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Select
              value={sortBy}
              onValueChange={setSortBy}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="size">Size</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Filter Options</DialogTitle>
                  <DialogDescription>
                    Customize how your starred files are displayed.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div className="space-y-2">
                    <h4 className="font-medium">File Types</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="filter-documents" />
                        <Label htmlFor="filter-documents">Documents</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="filter-images" />
                        <Label htmlFor="filter-images">Images</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="filter-videos" />
                        <Label htmlFor="filter-videos">Videos</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="filter-audio" />
                        <Label htmlFor="filter-audio">Audio</Label>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Date Added</h4>
                    <Select defaultValue="any">
                      <SelectTrigger>
                        <SelectValue placeholder="Select date range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any time</SelectItem>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="week">This week</SelectItem>
                        <SelectItem value="month">This month</SelectItem>
                        <SelectItem value="year">This year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Storage Provider</h4>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Switch id="provider-gdrive" />
                        <Label htmlFor="provider-gdrive">Google Drive</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="provider-dropbox" />
                        <Label htmlFor="provider-dropbox">Dropbox</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="provider-onedrive" />
                        <Label htmlFor="provider-onedrive">OneDrive</Label>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setView('grid')}>
                  <Grid className="h-4 w-4 mr-2" />
                  Grid View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView('list')}>
                  <LayoutList className="h-4 w-4 mr-2" />
                  List View
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Star className="h-4 w-4 mr-2" />
                  Remove All Stars
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array(8).fill(null).map((_, i) => (
              <div key={i} className="border rounded-lg overflow-hidden">
                <Skeleton className="h-32 w-full" />
                <div className="p-3">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-muted inline-flex rounded-full p-3 mb-4">
              <Star className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No starred files yet</h3>
            <p className="text-muted-foreground mb-4 max-w-md mx-auto">
              Star your important files and folders to access them quickly in the future.
            </p>
            <Button>Browse Files</Button>
          </div>
        ) : (
          <FileGrid files={files} view={view} />
        )}
      </div>
    </AppLayout>
  );
};

export default StarredPage;
