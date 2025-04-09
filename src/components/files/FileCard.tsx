
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileContextMenu } from './FileContextMenu';
import {
  File,
  FileText,
  Image,
  Music,
  Video,
  Folder,
  MoreVertical,
  Download,
  Share2,
  Star,
  Trash2
} from 'lucide-react';
import { FileItem } from '@/types/file';
import { formatDistanceToNow } from 'date-fns';
import { formatBytes } from '@/lib/utils';

export interface FileCardProps {
  file: FileItem;
  view: 'grid' | 'list';
  onOpen?: (file: FileItem) => void;
  onSelect?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onCopy?: (file: FileItem) => void;
  onMove?: (file: FileItem) => void;
  onDetails?: (file: FileItem) => void;
}

export const FileCard = ({
  file,
  view,
  onOpen,
  onSelect,
  onDownload,
  onShare,
  onRename,
  onDelete,
  onCopy,
  onMove,
  onDetails,
}: FileCardProps) => {
  const getFileIcon = () => {
    if (file.is_folder) {
      return <Folder className="h-6 w-6 text-blue-500" />;
    }

    const mime = file.mime_type?.toLowerCase() || '';

    if (mime.startsWith('image/')) {
      return <Image className="h-6 w-6 text-green-500" />;
    } else if (mime.startsWith('video/')) {
      return <Video className="h-6 w-6 text-purple-500" />;
    } else if (mime.startsWith('audio/')) {
      return <Music className="h-6 w-6 text-yellow-500" />;
    } else if (mime.startsWith('text/') || mime.includes('document') || mime.includes('pdf')) {
      return <FileText className="h-6 w-6 text-red-500" />;
    } else {
      return <File className="h-6 w-6 text-gray-500" />;
    }
  };

  const getFileSize = () => {
    if (file.is_folder) {
      return '';
    }
    return formatBytes(file.size);
  };
  
  const getModifiedDate = () => {
    try {
      return formatDistanceToNow(new Date(file.updated_at), { addSuffix: true });
    } catch (error) {
      return 'Unknown date';
    }
  };

  const handleFileClick = () => {
    if (onOpen) {
      onOpen(file);
    }
  };

  // Grid view
  if (view === 'grid') {
    return (
      <FileContextMenu
        file={file}
        onOpen={onOpen}
        onDownload={onDownload}
        onShare={onShare}
        onRename={onRename}
        onDelete={onDelete}
        onCopy={onCopy}
        onMove={onMove}
        onDetails={onDetails}
      >
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="p-4">
            <div className="flex flex-col items-center" onClick={handleFileClick}>
              <div className="bg-muted rounded-md p-4 mb-3">
                {getFileIcon()}
              </div>
              <div className="text-center">
                <div className="font-medium text-sm truncate max-w-[120px]" title={file.filename}>
                  {file.filename}
                </div>
                <div className="text-muted-foreground text-xs">
                  {getFileSize()}
                </div>
              </div>
            </div>
            <div className="mt-2 flex justify-around">
              {!file.is_folder && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0"
                  onClick={(e) => { e.stopPropagation(); onDownload?.(file); }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onShare?.(file); }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 w-7 p-0"
                onClick={(e) => { e.stopPropagation(); onDelete?.(file); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </FileContextMenu>
    );
  }

  // List view
  return (
    <FileContextMenu
      file={file}
      onOpen={onOpen}
      onDownload={onDownload}
      onShare={onShare}
      onRename={onRename}
      onDelete={onDelete}
      onCopy={onCopy}
      onMove={onMove}
      onDetails={onDetails}
    >
      <div 
        className="flex items-center px-4 py-3 hover:bg-muted/50 cursor-pointer"
        onClick={handleFileClick}
      >
        <div className="flex flex-1 items-center">
          <div className="mr-2">
            {getFileIcon()}
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate" title={file.filename}>
              {file.filename}
            </div>
            <div className="text-xs text-muted-foreground">
              {getModifiedDate()} • {getFileSize()}
            </div>
          </div>
        </div>
        <div className="w-1/5 hidden md:block text-sm text-muted-foreground">
          {file.provider_id ? 'External' : 'Local'}
        </div>
        <div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); }}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </FileContextMenu>
  );
};
