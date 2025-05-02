
import React, { useEffect, useState } from 'react';
import { FileItem } from '@/types/file';
import { fileOperations } from '@/services/fileOperations';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Eye, FileText, Image, Film, Music, Code, File, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';

interface FilePreviewProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, open, onOpenChange }) => {
  const [loading, setLoading] = useState(false);
  const [fileContent, setFileContent] = useState<{ url: string; type: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'info' | 'sharing'>('preview');

  useEffect(() => {
    if (file && open && !file.is_folder) {
      loadFileContent();
    } else {
      setFileContent(null);
      setPreviewError(null);
    }
  }, [file, open]);

  const loadFileContent = async () => {
    if (!file) return;

    setLoading(true);
    setPreviewError(null);
    
    try {
      const result = await fileOperations.getFileContent(file.id);
      
      if (!result) {
        setPreviewError('Failed to load file');
        setFileContent(null);
        return;
      }
      
      const url = URL.createObjectURL(result.content);
      setFileContent({ url, type: result.mimeType });
    } catch (error) {
      console.error('Error loading file content:', error);
      setPreviewError('Failed to load file for preview');
      setFileContent(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (fileContent) {
      const a = document.createElement('a');
      a.href = fileContent.url;
      a.download = file?.filename || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  
  const renderPreview = () => {
    if (loading) {
      return (
        <div className="w-full h-[60vh] flex justify-center items-center">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-[40vh] w-full max-w-xl" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
      );
    }

    if (previewError || !fileContent) {
      return (
        <div className="w-full h-[60vh] flex justify-center items-center">
          <div className="flex flex-col items-center gap-4">
            <XCircle size={64} className="text-muted-foreground" />
            <p className="text-muted-foreground">{previewError || 'Preview not available'}</p>
          </div>
        </div>
      );
    }

    if (fileContent.type.startsWith('image/')) {
      return (
        <div className="w-full h-[60vh] overflow-auto flex justify-center p-4">
          <img 
            src={fileContent.url} 
            alt={file?.filename || 'Image preview'} 
            className="object-contain max-w-full max-h-full"
          />
        </div>
      );
    }

    if (fileContent.type.startsWith('video/')) {
      return (
        <div className="w-full h-[60vh] overflow-auto flex justify-center p-4">
          <video 
            src={fileContent.url} 
            controls 
            className="max-w-full max-h-full" 
          />
        </div>
      );
    }

    if (fileContent.type.startsWith('audio/')) {
      return (
        <div className="w-full h-[60vh] flex justify-center items-center p-4">
          <div className="flex flex-col items-center gap-4">
            <Music size={48} className="text-primary" />
            <audio src={fileContent.url} controls />
            <p className="text-sm text-muted-foreground">{file?.filename}</p>
          </div>
        </div>
      );
    }

    if (fileContent.type.startsWith('text/') || 
        fileContent.type.includes('json') || 
        fileContent.type.includes('javascript') || 
        fileContent.type.includes('xml')) {
      return (
        <div className="w-full h-[60vh] overflow-auto p-4">
          <iframe 
            src={fileContent.url} 
            title={file?.filename || 'Text preview'} 
            className="w-full h-full border rounded-md"
          />
        </div>
      );
    }

    if (fileContent.type.includes('pdf')) {
      return (
        <div className="w-full h-[60vh] overflow-auto p-4">
          <iframe 
            src={fileContent.url} 
            title={file?.filename || 'PDF preview'} 
            className="w-full h-full border rounded-md"
          />
        </div>
      );
    }

    // Fallback for other file types
    return (
      <div className="w-full h-[60vh] flex justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <File size={64} className="text-primary" />
          <p className="text-lg font-medium">{file?.filename}</p>
          <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
          <Button onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    );
  };

  const getFileIcon = () => {
    if (!file || !file.mime_type) return <FileText />;
    
    if (file.mime_type.startsWith('image/')) return <Image />;
    if (file.mime_type.startsWith('video/')) return <Film />;
    if (file.mime_type.startsWith('audio/')) return <Music />;
    if (file.mime_type.includes('pdf')) return <FileText />;
    if (file.mime_type.startsWith('text/') || 
        file.mime_type.includes('json') || 
        file.mime_type.includes('javascript') || 
        file.mime_type.includes('xml')) return <Code />;
    
    return <File />;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getFileIcon()}
            <DialogTitle>{file?.filename}</DialogTitle>
          </div>
          <DialogDescription>
            {file?.mime_type} • {file?.size ? formatFileSize(file.size) : 'Unknown size'}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="preview" value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="info">Information</TabsTrigger>
            <TabsTrigger value="sharing">Sharing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview">
            {renderPreview()}
          </TabsContent>
          
          <TabsContent value="info">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Filename</h4>
                  <p className="text-sm">{file?.filename}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Type</h4>
                  <p className="text-sm">{file?.mime_type || 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Size</h4>
                  <p className="text-sm">{file?.size ? formatFileSize(file.size) : 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                  <p className="text-sm">{file?.created_at ? formatDate(file.created_at) : 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Modified</h4>
                  <p className="text-sm">{file?.updated_at ? formatDate(file.updated_at) : 'Unknown'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Last accessed</h4>
                  <p className="text-sm">{file?.last_accessed_at ? formatDate(file.last_accessed_at) : 'Never'}</p>
                </div>
                <div className="col-span-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Path</h4>
                  <p className="text-sm font-mono">{file?.path || 'Unknown'}</p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="sharing">
            <div className="space-y-4">
              <div className="p-4 rounded-md bg-muted flex items-center justify-between">
                <div>
                  <h4 className="font-medium">File sharing</h4>
                  <p className="text-sm text-muted-foreground">Share this file with others</p>
                </div>
                <Button disabled={!file}>
                  Share File
                </Button>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Currently shared with</h4>
                <div className="text-sm text-muted-foreground text-center py-4">
                  {file?.is_shared ? (
                    <p>This file has been shared</p>
                  ) : (
                    <p>This file is not shared with anyone</p>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        
        <DialogFooter>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={!fileContent}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
