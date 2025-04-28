
import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileCard } from '@/components/files/FileCard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { ArrowUpDown, Grid, List, Search, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatBytes } from '@/lib/utils';
import { FileOperationsDrawer } from '@/components/files/FileOperationsDrawer';
import { FileItem } from '@/types/file';

// Sample data - this would be replaced with real data from the API
const mockStorageData = [
  { name: 'Google Drive', value: 15, color: '#4285F4', used: 8, freeStorageSize: '7GB' },
  { name: 'Dropbox', value: 2, color: '#0061FF', used: 1, freeStorageSize: '1GB' },
  { name: 'OneDrive', value: 5, color: '#0078D4', used: 3, freeStorageSize: '2GB' },
  { name: 'Local', value: 10, color: '#22C55E', used: 2, freeStorageSize: '8GB' },
];

const mockFileList: FileItem[] = [
  {
    id: '1',
    filename: 'Project Proposal.pdf',
    path: '/Project Proposal.pdf',
    size: 2500000,
    mime_type: 'application/pdf',
    is_folder: false,
    created_at: '2023-07-15T10:30:00Z',
    updated_at: '2023-07-15T10:30:00Z',
    user_id: 'user1',
    is_starred: true,
    provider: 'Google Drive'
  },
  {
    id: '2',
    filename: 'Vacation Photos',
    path: '/Vacation Photos',
    size: 0,
    is_folder: true,
    created_at: '2023-06-20T14:15:00Z',
    updated_at: '2023-06-25T09:45:00Z',
    user_id: 'user1',
    provider: 'Dropbox'
  },
  {
    id: '3',
    filename: 'Financial Report Q2.xlsx',
    path: '/Financial Report Q2.xlsx',
    size: 1800000,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    is_folder: false,
    created_at: '2023-07-01T08:20:00Z',
    updated_at: '2023-07-10T16:45:00Z',
    user_id: 'user1',
    is_shared: true,
    provider: 'OneDrive'
  },
  {
    id: '4',
    filename: 'Company Logo.png',
    path: '/Company Logo.png',
    size: 350000,
    mime_type: 'image/png',
    is_folder: false,
    created_at: '2023-05-12T11:20:00Z',
    updated_at: '2023-05-12T11:20:00Z',
    user_id: 'user1',
    is_starred: true,
    provider: 'Local'
  },
];

const StoragePage = () => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [fileOperation, setFileOperation] = useState<'rename' | 'share' | 'details' | null>(null);
  const [totalStorage] = useState<number>(mockStorageData.reduce((acc, item) => acc + item.value, 0));
  const [usedStorage] = useState<number>(mockStorageData.reduce((acc, item) => acc + item.used, 0));
  const [recentAccess] = useState([
    { title: 'Today', count: 5, date: (new Date()).toISOString() },
    { title: 'Yesterday', count: 8, date: (new Date(Date.now() - 86400000)).toISOString() },
    { title: 'Last Week', count: 15, date: (new Date(Date.now() - 7 * 86400000)).toISOString() },
    { title: 'Last Month', count: 42, date: (new Date(Date.now() - 30 * 86400000)).toISOString() },
  ]);
  
  // Filter files based on search query
  const filteredFiles = mockFileList.filter(
    file => file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenFile = (file: FileItem) => {
    console.log('Opening file:', file);
    // Logic to open a file or navigate into a folder
  };
  
  const handleShareFile = (file: FileItem) => {
    setSelectedFile(file);
    setFileOperation('share');
  };
  
  const handleRenameFile = (file: FileItem) => {
    setSelectedFile(file);
    setFileOperation('rename');
  };
  
  const handleDeleteFile = (file: FileItem) => {
    console.log('Delete file:', file);
    // Logic to delete a file
  };
  
  const handleFileDetails = (file: FileItem) => {
    setSelectedFile(file);
    setFileOperation('details');
  };
  
  const handleCloseDrawer = () => {
    setSelectedFile(null);
    setFileOperation(null);
  };
  
  const handleRenameSubmit = (file: FileItem, newName: string) => {
    console.log('Rename file:', file, 'to:', newName);
    // Logic to rename a file
    handleCloseDrawer();
  };
  
  const handleShareSubmit = (file: FileItem, shareSettings: { email: string; permission: 'view' | 'edit' | 'admin' }) => {
    console.log('Share file:', file, 'with settings:', shareSettings);
    // Logic to share a file
    handleCloseDrawer();
  };

  return (
    <AppLayout title="Storage">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="lg:w-2/3">
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <CardTitle>Files</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className={view === 'grid' ? 'bg-secondary' : ''}
                    onClick={() => setView('grid')}
                  >
                    <Grid className="h-[1.2rem] w-[1.2rem]" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className={view === 'list' ? 'bg-secondary' : ''}
                    onClick={() => setView('list')}
                  >
                    <List className="h-[1.2rem] w-[1.2rem]" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <SlidersHorizontal className="h-[1.2rem] w-[1.2rem]" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSortBy('name')}>
                        Name {sortBy === 'name' && '✓'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('date')}>
                        Date {sortBy === 'date' && '✓'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('size')}>
                        Size {sortBy === 'size' && '✓'}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search files..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </CardHeader>
            <CardContent>
              {filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No files found. Try adjusting your search criteria.
                </div>
              ) : view === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      view="grid"
                      onOpen={handleOpenFile}
                      onShare={handleShareFile}
                      onRename={handleRenameFile}
                      onDelete={handleDeleteFile}
                      onDetails={handleFileDetails}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      view="list"
                      onOpen={handleOpenFile}
                      onShare={handleShareFile}
                      onRename={handleRenameFile}
                      onDelete={handleDeleteFile}
                      onDetails={handleFileDetails}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <FileOperationsDrawer
            file={selectedFile}
            operation={fileOperation}
            onClose={handleCloseDrawer}
            onRename={handleRenameSubmit}
            onShare={handleShareSubmit}
          />
        </div>
        
        <div className="lg:w-1/3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Storage</CardTitle>
              <CardDescription>
                {formatBytes(usedStorage * 1024 * 1024 * 1024)} of {formatBytes(totalStorage * 1024 * 1024 * 1024)} used
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={mockStorageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="used"
                  >
                    {mockStorageData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${formatBytes(value * 1024 * 1024 * 1024)} used`, null]}
                  />
                  <Legend formatter={(value) => {
                    const item = mockStorageData.find(d => d.name === value);
                    return `${value} (${item?.freeStorageSize} free)`;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="accessed">
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="accessed" className="flex-1">Accessed</TabsTrigger>
                  <TabsTrigger value="uploaded" className="flex-1">Uploaded</TabsTrigger>
                  <TabsTrigger value="shared" className="flex-1">Shared</TabsTrigger>
                </TabsList>
                <TabsContent value="accessed">
                  <div className="space-y-4">
                    {recentAccess.map((item, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="font-medium">{item.title}</span>
                        <div className="text-right">
                          <span className="text-xl font-bold">{item.count}</span>
                          <span className="text-muted-foreground ml-2">files</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="uploaded">
                  <div className="text-center py-8 text-muted-foreground">
                    No recent uploads
                  </div>
                </TabsContent>
                <TabsContent value="shared">
                  <div className="text-center py-8 text-muted-foreground">
                    No recent shares
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default StoragePage;
