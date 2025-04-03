
import React from 'react';
import { FileCard, FileItem } from './FileCard';

interface FileGridProps {
  files: FileItem[];
  view: 'grid' | 'list';
  onFileOpen?: (file: FileItem) => void;
  onFileSelect?: (file: FileItem) => void;
}

export const FileGrid = ({ files, view, onFileOpen, onFileSelect }: FileGridProps) => {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 text-center">
        <div className="text-muted-foreground mb-2">
          <svg
            className="mx-auto h-12 w-12"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <path d="M13 2v7h7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium">No files found</h3>
        <p className="text-muted-foreground mt-1">
          Upload files or create a new folder to get started.
        </p>
      </div>
    );
  }

  if (view === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {files.map((file) => (
          <FileCard 
            key={file.id} 
            file={file} 
            view={view}
            onOpen={onFileOpen}
            onSelect={onFileSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border rounded-md border">
      <div className="bg-muted/50 px-4 py-3 text-sm font-medium flex">
        <div className="flex-1">Name</div>
        <div className="w-1/5 hidden md:block">Provider</div>
        <div className="w-24 text-right">Actions</div>
      </div>
      <div>
        {files.map((file) => (
          <FileCard 
            key={file.id} 
            file={file} 
            view={view}
            onOpen={onFileOpen}
            onSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
};
