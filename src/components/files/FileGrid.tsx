
import React from 'react';
import { FileCard } from '@/components/files/FileCard';
import { FileItem } from '@/types/file';

export interface FileGridProps {
  files: FileItem[];
  view?: 'grid' | 'list';
  onFileClick?: (file: FileItem) => void;
  onFileOpen?: (file: FileItem) => void; // Add this prop
  onStarClick?: (file: FileItem) => Promise<void>;
  onDeleteClick?: (file: FileItem) => Promise<void>;
  onShareClick?: (file: FileItem) => void;
  onDownloadClick?: (file: FileItem) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  view = 'list',
  onFileClick,
  onFileOpen, // Make sure to include this
  onStarClick,
  onDeleteClick,
  onShareClick,
  onDownloadClick,
}) => {
  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No files found
      </div>
    );
  }

  return (
    <div className={view === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'divide-y'}>
      {files.map((file) => (
        <FileCard
          key={file.id}
          file={file}
          view={view}
          onOpen={onFileOpen || onFileClick} // Use either prop
          onDownload={onDownloadClick}
          onShare={onShareClick}
          onDelete={onDeleteClick}
        />
      ))}
    </div>
  );
};
