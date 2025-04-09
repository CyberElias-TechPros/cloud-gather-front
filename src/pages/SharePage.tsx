
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { FileItem } from '@/types/file';
import { Download, FileText, Image, Video, Music, File, Folder, Calendar, User, Shield, Loader2 } from 'lucide-react';
import { formatBytes, formatDate } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const SharePage: React.FC = () => {
  const { fileId } = useParams<{ fileId: string }>();
  const [file, setFile] = useState<FileItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchSharedFile = async () => {
      if (!fileId) {
        setError('Invalid file ID');
        setLoading(false);
        return;
      }
      
      try {
        // In a real implementation, fetch the shared file details using the fileId
        // For now, simulate an API call with a timeout
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simulate file data (in a real app, this would come from the API)
        const mockFile: FileItem = {
          id: fileId,
          filename: 'Shared Document.pdf',
          size: 2500000,
          mime_type: 'application/pdf',
          path: '/shared/document.pdf',
          is_folder: false,
          provider_id: null,
          provider_file_id: null,
          is_starred: false,
          is_shared: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
          parent_folder_id: null,
          user_id: 'user-123',
          type: 'document',
          modified: '2 days ago'
        };
        
        setFile(mockFile);
      } catch (err) {
        console.error('Error fetching shared file:', err);
        setError('Failed to load the shared file. It may have expired or been removed.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSharedFile();
  }, [fileId]);

  const handleDownload = async () => {
    if (!file) return;
    
    setDownloading(true);
    
    try {
      // In a real implementation, this would download the actual file
      // For demo purposes, we'll just show a success message after a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('File downloaded successfully');
    } catch (err) {
      console.error('Error downloading file:', err);
      toast.error('Failed to download the file');
    } finally {
      setDownloading(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <File className="h-16 w-16 text-gray-500" />;
    
    if (file.is_folder) {
      return <Folder className="h-16 w-16 text-blue-500" />;
    }

    const mime = file.mime_type?.toLowerCase() || '';

    if (mime.startsWith('image/')) {
      return <Image className="h-16 w-16 text-green-500" />;
    } else if (mime.startsWith('video/')) {
      return <Video className="h-16 w-16 text-purple-500" />;
    } else if (mime.startsWith('audio/')) {
      return <Music className="h-16 w-16 text-yellow-500" />;
    } else if (mime.startsWith('text/') || mime.includes('document') || mime.includes('pdf')) {
      return <FileText className="h-16 w-16 text-red-500" />;
    } else {
      return <File className="h-16 w-16 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-xl font-medium">Loading shared file...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Shared File Unavailable</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Link to="/">
              <Button variant="outline">Return to Home</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="h-6 w-6 text-primary"
            >
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
            <Link to="/" className="text-xl font-bold">CloudUnity</Link>
          </div>
          
          <div>
            <Link to="/auth">
              <Button variant="outline" size="sm">Sign In</Button>
            </Link>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center py-12">
        <div className="container mx-auto max-w-3xl px-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center space-x-4">
                <div className="bg-muted rounded-lg p-4">
                  {getFileIcon()}
                </div>
                <div className="space-y-1">
                  <h1 className="text-2xl font-bold">{file?.filename}</h1>
                  <p className="text-muted-foreground">Shared with you</p>
                </div>
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">{formatDate(file?.updated_at || null)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Shared By</p>
                    <p className="text-sm text-muted-foreground">CloudUnity User</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <File className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">File Size</p>
                    <p className="text-sm text-muted-foreground">{formatBytes(file?.size || 0)}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Permissions</p>
                    <p className="text-sm text-muted-foreground">View only</p>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="h-48 flex items-center justify-center bg-muted rounded-lg">
                  <div className="text-center">
                    <div className="mb-2">
                      {getFileIcon()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preview not available. Download to view the file.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="flex justify-between">
              <Link to="/">
                <Button variant="outline">Go to CloudUnity</Button>
              </Link>
              
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Download File
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          <div className="mt-8 text-center">
            <p className="text-muted-foreground text-sm">
              Want to manage your own files across multiple cloud providers?
            </p>
            <Link to="/auth?signup=true" className="text-primary hover:underline text-sm">
              Sign up for CloudUnity today
            </Link>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2023 CloudUnity. All rights reserved.
            </p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms of Service
              </Link>
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SharePage;
