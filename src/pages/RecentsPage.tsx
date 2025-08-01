
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileItem } from '@/types/file';
import {
  Clock,
  FileText,
  Image,
  Video,
  Music,
  Archive,
  Folder,
  Search,
  MoreVertical,
  Download,
  Share2,
  Star,
  Eye,
  Calendar,
  Filter,
  Loader2
} from 'lucide-react';

interface RecentFile extends FileItem {
  accessType: 'opened' | 'modified' | 'created' | 'shared';
  accessTime: string;
}

const RecentsPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<RecentFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      window.location.href = '/auth';
      return;
    }
    
    loadRecentFiles();
  }, [user, authLoading]);

  useEffect(() => {
    filterFiles();
  }, [recentFiles, searchTerm, timeFilter, typeFilter]);

  const loadRecentFiles = async () => {
    setLoading(true);
    
    try {
      // Get recent files based on last_accessed_at and created_at
      const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .not('last_accessed_at', 'is', null)
        .order('last_accessed_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Transform files to include access information
      const recentFiles: RecentFile[] = files?.map(file => ({
        ...file,
        accessType: determineAccessType(file),
        accessTime: file.last_accessed_at || file.updated_at || file.created_at,
        // Ensure compatibility fields
        isFolder: file.is_folder || false,
        type: file.mime_type || 'file',
        modified: file.updated_at,
        provider: file.provider_id || 'local'
      })) || [];

      setRecentFiles(recentFiles);
    } catch (error) {
      console.error('Error loading recent files:', error);
      toast.error('Failed to load recent files');
    } finally {
      setLoading(false);
    }
  };

  const determineAccessType = (file: any): 'opened' | 'modified' | 'created' | 'shared' => {
    const now = new Date();
    const lastAccessed = new Date(file.last_accessed_at || file.updated_at);
    const created = new Date(file.created_at);
    const updated = new Date(file.updated_at);
    
    // If file was shared recently
    if (file.is_shared) return 'shared';
    
    // If last accessed is very recent compared to creation/update
    if (lastAccessed.getTime() > Math.max(created.getTime(), updated.getTime()) + 60000) {
      return 'opened';
    }
    
    // If updated recently
    if (updated.getTime() > created.getTime() + 60000) {
      return 'modified';
    }
    
    return 'created';
  };

  const filterFiles = () => {
    let filtered = [...recentFiles];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(file => 
        file.filename.toLowerCase().includes(search)
      );
    }

    // Apply time filter
    const now = new Date();
    switch (timeFilter) {
      case 'today':
        filtered = filtered.filter(file => {
          const accessDate = new Date(file.accessTime);
          return accessDate.toDateString() === now.toDateString();
        });
        break;
      case 'week':
        filtered = filtered.filter(file => {
          const accessDate = new Date(file.accessTime);
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return accessDate >= weekAgo;
        });
        break;
      case 'month':
        filtered = filtered.filter(file => {
          const accessDate = new Date(file.accessTime);
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return accessDate >= monthAgo;
        });
        break;
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(file => {
        if (typeFilter === 'folders') return file.isFolder;
        if (typeFilter === 'images') return file.mime_type?.startsWith('image/');
        if (typeFilter === 'documents') return file.mime_type?.includes('pdf') || file.mime_type?.includes('document');
        if (typeFilter === 'videos') return file.mime_type?.startsWith('video/');
        if (typeFilter === 'audio') return file.mime_type?.startsWith('audio/');
        return true;
      });
    }

    setFilteredFiles(filtered);
  };

  const getFileIcon = (file: RecentFile) => {
    if (file.isFolder) return Folder;
    
    const mimeType = file.mime_type || '';
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.startsWith('audio/')) return Music;
    if (mimeType.includes('zip') || mimeType.includes('archive')) return Archive;
    
    return FileText;
  };

  const getAccessTypeLabel = (type: string) => {
    switch (type) {
      case 'opened': return 'Opened';
      case 'modified': return 'Modified';
      case 'created': return 'Created';
      case 'shared': return 'Shared';
      default: return 'Accessed';
    }
  };

  const getAccessTypeColor = (type: string) => {
    switch (type) {
      case 'opened': return 'bg-blue-100 text-blue-800';
      case 'modified': return 'bg-green-100 text-green-800';
      case 'created': return 'bg-purple-100 text-purple-800';
      case 'shared': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (authLoading || loading) {
    return (
      <AppLayout title="Recent Files">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading recent files...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Recent Files">
      <div className="space-y-6">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recent files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-2" />
                  {timeFilter === 'all' ? 'All time' : timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTimeFilter('today')}>Today</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeFilter('week')}>This week</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeFilter('month')}>This month</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTimeFilter('all')}>All time</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  {typeFilter === 'all' ? 'All types' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setTypeFilter('all')}>All types</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('folders')}>Folders</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('images')}>Images</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('documents')}>Documents</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('videos')}>Videos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTypeFilter('audio')}>Audio</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {filteredFiles.length} of {recentFiles.length} files
          </p>
        </div>

        {/* Recent Files List */}
        {filteredFiles.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchTerm || timeFilter !== 'all' || typeFilter !== 'all' 
                  ? 'No files match your filters' 
                  : 'No recent files'
                }
              </h3>
              <p className="text-muted-foreground text-center mb-4">
                {searchTerm || timeFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your search terms or filters'
                  : 'Files you open, create, or modify will appear here'
                }
              </p>
              {(searchTerm || timeFilter !== 'all' || typeFilter !== 'all') && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm('');
                    setTimeFilter('all');
                    setTypeFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredFiles.map((file) => {
              const Icon = getFileIcon(file);
              
              return (
                <Card key={file.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{file.filename}</h3>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getAccessTypeColor(file.accessType)}`}
                          >
                            {getAccessTypeLabel(file.accessType)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{formatTimeAgo(file.accessTime)}</span>
                          {!file.isFolder && (
                            <span>{formatBytes(file.size)}</span>
                          )}
                          {file.mime_type && (
                            <span className="capitalize">
                              {file.mime_type.split('/')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {file.is_starred && (
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                        )}
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              Open
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Share2 className="h-4 w-4 mr-2" />
                              Share
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Star className="h-4 w-4 mr-2" />
                              {file.is_starred ? 'Unstar' : 'Star'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default RecentsPage;
