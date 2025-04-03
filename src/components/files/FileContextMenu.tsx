
import React from 'react';
import { FileItem } from './FileCard';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Download,
  Share,
  Edit,
  Trash,
  Copy,
  Move,
  Lock,
  Shield,
  Tag,
  Info,
  FolderPlus,
  Star,
  CloudOff,
  CloudCog,
} from 'lucide-react';

interface FileContextMenuProps {
  children: React.ReactNode;
  file: FileItem;
  onOpen?: (file: FileItem) => void;
  onDownload?: (file: FileItem) => void;
  onShare?: (file: FileItem) => void;
  onRename?: (file: FileItem) => void;
  onDelete?: (file: FileItem) => void;
  onCopy?: (file: FileItem) => void;
  onMove?: (file: FileItem) => void;
  onDetails?: (file: FileItem) => void;
}

export const FileContextMenu = ({
  children,
  file,
  onOpen,
  onDownload,
  onShare,
  onRename,
  onDelete,
  onCopy,
  onMove,
  onDetails,
}: FileContextMenuProps) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={() => onOpen?.(file)} className="cursor-pointer">
          <Info className="mr-2 h-4 w-4" />
          {file.isFolder ? 'Open Folder' : 'Open File'}
        </ContextMenuItem>
        
        {!file.isFolder && (
          <ContextMenuItem onClick={() => onDownload?.(file)} className="cursor-pointer">
            <Download className="mr-2 h-4 w-4" />
            Download
          </ContextMenuItem>
        )}
        
        <ContextMenuItem onClick={() => onShare?.(file)} className="cursor-pointer">
          <Share className="mr-2 h-4 w-4" />
          Share
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => onRename?.(file)} className="cursor-pointer">
          <Edit className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => onCopy?.(file)} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          Copy to
        </ContextMenuItem>
        
        <ContextMenuItem onClick={() => onMove?.(file)} className="cursor-pointer">
          <Move className="mr-2 h-4 w-4" />
          Move to
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <CloudCog className="mr-2 h-4 w-4" />
            Storage options
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem>
              <Star className="mr-2 h-4 w-4" />
              Set as high priority
            </ContextMenuItem>
            <ContextMenuItem>
              <CloudOff className="mr-2 h-4 w-4" />
              Keep offline
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <FolderPlus className="mr-2 h-4 w-4" />
              Move to specific provider
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Shield className="mr-2 h-4 w-4" />
            Security
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem>
              <Lock className="mr-2 h-4 w-4" />
              Encrypt file
            </ContextMenuItem>
            <ContextMenuItem>
              <Tag className="mr-2 h-4 w-4" />
              Set permissions
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={() => onDetails?.(file)} className="cursor-pointer">
          <Info className="mr-2 h-4 w-4" />
          File details
        </ContextMenuItem>
        
        <ContextMenuItem 
          onClick={() => onDelete?.(file)} 
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
