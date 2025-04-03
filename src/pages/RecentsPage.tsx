
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { FileGrid } from '@/components/files/FileGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CalendarDays, 
  Clock, 
  FileText, 
  Image as ImageIcon, 
  MoreHorizontal, 
  Video 
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const RecentsPage = () => {
  const [files, setFiles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = React.useState('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  return (
    <AppLayout title="Recent Files">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Recent Activity</h2>
          <div className="flex space-x-2">
            <div className="hidden md:flex items-center bg-muted rounded-md px-3 py-2">
              <Input 
                type="text" 
                placeholder="Search recent files..." 
                className="border-0 bg-transparent focus-visible:ring-0 h-8 p-0"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={filter}
              onValueChange={setFilter}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All files</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="images">Images</SelectItem>
                <SelectItem value="videos">Videos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs defaultValue="today" className="w-full">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
          
          {['today', 'yesterday', 'week', 'month'].map((period) => (
            <TabsContent key={period} value={period} className="mt-0 pt-4">
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
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No recent files</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    {period === 'today' && "You haven't accessed any files today."}
                    {period === 'yesterday' && "You didn't access any files yesterday."}
                    {period === 'week' && "You haven't accessed any files this week."}
                    {period === 'month' && "You haven't accessed any files this month."}
                  </p>
                  <Button>Upload a File</Button>
                </div>
              ) : (
                <FileGrid files={files} view={view} />
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8">
          <h3 className="text-lg font-medium mb-4">Recent File Types</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto py-6 flex items-center justify-center">
              <div className="text-center">
                <div className="bg-blue-50 text-blue-500 p-3 rounded-full mx-auto mb-3">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-medium">Documents</h3>
                <p className="text-muted-foreground text-sm mt-1">View recent documents</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex items-center justify-center">
              <div className="text-center">
                <div className="bg-green-50 text-green-500 p-3 rounded-full mx-auto mb-3">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <h3 className="font-medium">Images</h3>
                <p className="text-muted-foreground text-sm mt-1">View recent images</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex items-center justify-center">
              <div className="text-center">
                <div className="bg-purple-50 text-purple-500 p-3 rounded-full mx-auto mb-3">
                  <Video className="h-6 w-6" />
                </div>
                <h3 className="font-medium">Videos</h3>
                <p className="text-muted-foreground text-sm mt-1">View recent videos</p>
              </div>
            </Button>
            <Button variant="outline" className="h-auto py-6 flex items-center justify-center">
              <div className="text-center">
                <div className="bg-orange-50 text-orange-500 p-3 rounded-full mx-auto mb-3">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <h3 className="font-medium">View All</h3>
                <p className="text-muted-foreground text-sm mt-1">All recent files</p>
              </div>
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default RecentsPage;
