
import React from 'react';
import { FileCard } from '@/components/files/FileCard';
import { FileItem } from '@/types/file';

export interface FileGridProps {
  files: FileItem[];
  view?: 'grid' | 'list';
  onFileClick?: (file: FileItem) => void;
  onStarClick?: (file: FileItem) => Promise<void>;
  onDeleteClick?: (file: FileItem) => Promise<void>;
  onShareClick?: (file: FileItem) => void;
  onDownloadClick?: (file: FileItem) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  files,
  view = 'list',
  onFileClick,
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
          onOpen={onFileClick}
          onDownload={onDownloadClick}
          onShare={onShareClick}
          onDelete={onDeleteClick}
        />
      ))}
    </div>
  );
};
