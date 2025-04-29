
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { FileGrid } from '@/components/files/FileGrid';
import { FileItem } from '@/types/file';
import { getRecentFiles, getStarredFiles } from '@/services/cloudProviders';
import { useAuth } from '@/contexts/AuthContext';
import {
  Clock,
  Star,
  Search,
  Calendar,
  FileText,
  RefreshCcw,
  Loader2,
  Grid,
  List,
  Upload,
  SlidersHorizontal
} from 'lucide-react';

const RecentsPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [starredFiles, setStarredFiles] = useState<FileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timePeriod, setTimePeriod] = useState<'today' | 'yesterday' | 'week' | 'month'>('week');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  
  useEffect(() => {
    if (!user) return;
    loadFiles();
  }, [user, timePeriod]);
  
  const loadFiles = async () => {
    setLoading(true);
    try {
      // Load recent files based on selected time period
      const recentFilesData = await getRecentFiles(50, timePeriod);
      setRecentFiles(recentFilesData);
      
      // Load starred files
      const starredFilesData = await getStarredFiles();
      setStarredFiles(starredFilesData);
    } catch (error: any) {
      console.error('Error loading files:', error);
      toast.error(`Failed to load files: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileOpen = (file: FileItem) => {
    if (file.is_folder) {
      // Navigate to folder
      window.location.href = `/files?folder=${file.id}`;
    } else {
      // Preview/download file
      toast.info(`Opening ${file.filename}`);
    }
  };
  
  const handleRefresh = () => {
    loadFiles();
  };
  
  // Filter files based on search query
  const filterFiles = (files: FileItem[]) => {
    if (!searchQuery.trim()) return files;
    
    return files.filter(file => 
      file.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.mime_type && file.mime_type.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };
  
  const filteredRecentFiles = filterFiles(recentFiles);
  const filteredStarredFiles = filterFiles(starredFiles);

  // If user is not logged in
  if (!user) {
    return (
      <AppLayout title="Recent Files">
        <Card className="p-6">
          <CardContent className="flex flex-col items-center justify-center space-y-4 pt-6">
            <h2 className="text-xl font-semibold">Authentication Required</h2>
            <p className="text-center text-muted-foreground">
              You need to be logged in to view your recent files.
            </p>
            <Button className="mt-4" onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }
  
  return (
    <AppLayout title="Recent Activity">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold">Recent Activity</h1>
          <p className="text-muted-foreground">
            View your recently accessed and starred files
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Select value={timePeriod} onValueChange={(value) => setTimePeriod(value as any)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Today</span>
                </div>
              </SelectItem>
              <SelectItem value="yesterday">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Yesterday</span>
                </div>
              </SelectItem>
              <SelectItem value="week">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Past Week</span>
                </div>
              </SelectItem>
              <SelectItem value="month">
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  <span>Past Month</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex space-x-1">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setView('grid')}
              className={view === 'grid' ? 'bg-accent' : ''}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setView('list')}
              className={view === 'list' ? 'bg-accent' : ''}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in recent files..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <Tabs defaultValue="recent">
        <TabsList className="mb-4">
          <TabsTrigger value="recent">
            <Clock className="h-4 w-4 mr-2" />
            Recent Files
          </TabsTrigger>
          <TabsTrigger value="starred">
            <Star className="h-4 w-4 mr-2" />
            Starred
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="recent" className="mt-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span>Loading recent files...</span>
            </div>
          ) : filteredRecentFiles.length > 0 ? (
            <FileGrid 
              files={filteredRecentFiles} 
              view={view} 
              onFileOpen={handleFileOpen} 
            />
          ) : searchQuery ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-1">No matching files found</h3>
                <p className="text-center text-muted-foreground">
                  Try adjusting your search term or time filter.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-1">No recent files</h3>
                <p className="text-center text-muted-foreground mb-4">
                  You haven't accessed any files {timePeriod === 'today' ? 'today' : 
                                                timePeriod === 'yesterday' ? 'yesterday' : 
                                                timePeriod === 'week' ? 'in the past week' : 
                                                'in the past month'}.
                </p>
                <Button onClick={() => window.location.href = '/files'}>
                  <FileText className="h-4 w-4 mr-2" />
                  Browse All Files
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="starred" className="mt-0">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
              <span>Loading starred files...</span>
            </div>
          ) : filteredStarredFiles.length > 0 ? (
            <FileGrid 
              files={filteredStarredFiles} 
              view={view} 
              onFileOpen={handleFileOpen} 
            />
          ) : searchQuery ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Search className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-1">No matching starred files found</h3>
                <p className="text-center text-muted-foreground">
                  Try adjusting your search term or time filter.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-1">No starred files</h3>
                <p className="text-center text-muted-foreground mb-4">
                  Star files to easily access them from here.
                </p>
                <Button onClick={() => window.location.href = '/files'}>
                  <FileText className="h-4 w-4 mr-2" />
                  Browse All Files
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default RecentsPage;
