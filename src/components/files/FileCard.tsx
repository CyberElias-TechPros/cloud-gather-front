
import React from 'react';
import { 
  FileIcon, 
  FileText, 
  FileImage, 
  FileVideo, 
  FileMusic, 
  FileArchive, 
  FilePdf, 
  Folder,
  MoreVertical 
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  modified: Date;
  isFolder?: boolean;
  provider?: string;
}

interface FileCardProps {
  file: FileItem;
  view: 'grid' | 'list';
  onOpen?: (file: FileItem) => void;
  onSelect?: (file: FileItem) => void;
}

export const FileCard = ({ file, view, onOpen, onSelect }: FileCardProps) => {
  const getFileIcon = () => {
    if (file.isFolder) return <Folder />;
    
    if (file.type.startsWith('image/')) return <FileImage />;
    if (file.type.startsWith('video/')) return <FileVideo />;
    if (file.type.startsWith('audio/')) return <FileMusic />;
    if (file.type === 'application/pdf') return <FilePdf />;
    if (file.type.includes('zip') || file.type.includes('compressed')) return <FileArchive />;
    if (file.type.includes('text')) return <FileText />;
    
    return <FileIcon />;
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFileTypeColor = () => {
    if (file.isFolder) return 'bg-blue-100 text-blue-700';
    
    if (file.type.startsWith('image/')) return 'bg-pink-100 text-pink-700';
    if (file.type.startsWith('video/')) return 'bg-purple-100 text-purple-700';
    if (file.type.startsWith('audio/')) return 'bg-indigo-100 text-indigo-700';
    if (file.type === 'application/pdf') return 'bg-red-100 text-red-700';
    if (file.type.includes('zip') || file.type.includes('compressed')) return 'bg-yellow-100 text-yellow-700';
    if (file.type.includes('text')) return 'bg-green-100 text-green-700';
    
    return 'bg-gray-100 text-gray-700';
  };
  
  const handleOpen = () => {
    if (onOpen) onOpen(file);
  };
  
  const handleSelect = () => {
    if (onSelect) onSelect(file);
  };
  
  if (view === 'grid') {
    return (
      <Card className="group cloud-card flex flex-col overflow-hidden">
        <div className="relative pt-4 px-4 pb-2 flex items-center justify-center h-32">
          <div className={cn("w-16 h-16 flex items-center justify-center rounded-lg", getFileTypeColor())}>
            {getFileIcon()}
          </div>
          
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleOpen}>Open</DropdownMenuItem>
                <DropdownMenuItem>Download</DropdownMenuItem>
                <DropdownMenuItem>Share</DropdownMenuItem>
                <DropdownMenuItem>Rename</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="p-3 border-t border-border">
          <div className="font-medium truncate" title={file.name}>
            {file.name}
          </div>
          <div className="flex justify-between items-center mt-1 text-xs text-muted-foreground">
            <span>{!file.isFolder ? formatFileSize(file.size) : '—'}</span>
            <span>{formatDistanceToNow(file.modified, { addSuffix: true })}</span>
          </div>
        </div>
      </Card>
    );
  }
  
  return (
    <div 
      className="group flex items-center px-4 py-3 hover:bg-muted/50 rounded-md"
      onClick={handleSelect}
    >
      <div className={cn("w-10 h-10 flex items-center justify-center rounded-lg mr-3", getFileTypeColor())}>
        {getFileIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate" title={file.name}>
          {file.name}
        </div>
        <div className="text-xs text-muted-foreground">
          {!file.isFolder ? formatFileSize(file.size) : 'Folder'} • {formatDistanceToNow(file.modified, { addSuffix: true })}
        </div>
      </div>
      
      {file.provider && (
        <div className="hidden md:block text-xs text-muted-foreground px-2">
          {file.provider}
        </div>
      )}
      
      <div className="ml-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleOpen}>Open</DropdownMenuItem>
            <DropdownMenuItem>Download</DropdownMenuItem>
            <DropdownMenuItem>Share</DropdownMenuItem>
            <DropdownMenuItem>Rename</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
