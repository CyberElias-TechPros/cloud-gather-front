
import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { EnhancedFileGrid } from '@/components/files/EnhancedFileGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, FileText, Star, Share2, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FileItem } from '@/types/file';

const FilesPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [starredFiles, setStarredFiles] = useState<FileItem[]>([]);
  const [sharedFiles, setSharedFiles] = useState<FileItem[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('list');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = '/login';
      return;
    }
    
    loadFiles();
    
    // Set up real-time subscription for file changes
    const channel = supabase
      .channel('public:files')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'files' },
        () => {
          // Reload files when changes occur
          loadFiles();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, authLoading]);

  const loadFiles = async () => {
    if (!user) return;
    
    setLoading(true);
    
    try {
      // Get all files (only root level for initial load)
      const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .is('parent_folder_id', null)
        .order('updated_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setAllFiles(files || []);
      
      // Get starred files
      const { data: starred, error: starredError } = await supabase
        .from('files')
        .select('*')
        .eq('is_starred', true)
        .order('updated_at', { ascending: false });
      
      if (starredError) {
        throw starredError;
      }
      
      setStarredFiles(starred || []);
      
      // Get shared files
      const { data: shared, error: sharedError } = await supabase
        .from('files')
        .select('*')
        .eq('is_shared', true)
        .order('updated_at', { ascending: false });
      
      if (sharedError) {
        throw sharedError;
      }
      
      setSharedFiles(shared || []);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <AppLayout title="Files">
        <div className="flex justify-center items-center h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Checking authentication...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Files">
      <div className="space-y-4">
        <Tabs defaultValue="all">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all">
                <FolderOpen className="h-4 w-4 mr-2" />
                All Files
              </TabsTrigger>
              <TabsTrigger value="starred">
                <Star className="h-4 w-4 mr-2" />
                Starred
              </TabsTrigger>
              <TabsTrigger value="shared">
                <Share2 className="h-4 w-4 mr-2" />
                Shared
              </TabsTrigger>
            </TabsList>
            
            <div className="flex items-center">
              <div className="border-r pr-4 mr-4">
                <div className="text-xs text-muted-foreground">Storage Used</div>
                <div className="text-sm font-medium">- / -</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Files</div>
                <div className="text-sm font-medium">{allFiles.length}</div>
              </div>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-6">
              <TabsContent value="all" className="m-0">
                <EnhancedFileGrid
                  initialFiles={allFiles}
                  view={view}
                />
              </TabsContent>
              
              <TabsContent value="starred" className="m-0">
                <EnhancedFileGrid
                  initialFiles={starredFiles}
                  view={view}
                />
              </TabsContent>
              
              <TabsContent value="shared" className="m-0">
                <EnhancedFileGrid
                  initialFiles={sharedFiles}
                  view={view}
                />
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default FilesPage;
