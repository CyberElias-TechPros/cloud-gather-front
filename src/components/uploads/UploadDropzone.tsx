
import React, { useCallback, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  maxSize?: number;
  acceptedTypes?: string[];
}

export const UploadDropzone = ({ 
  onFilesSelected, 
  maxFiles = 10,
  maxSize = 100 * 1024 * 1024, // 100MB
  acceptedTypes = ['*/*']
}: UploadDropzoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const validateFiles = (files: File[]): boolean => {
    if (files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return false;
    }
    
    for (const file of files) {
      if (file.size > maxSize) {
        setError(`File size exceeds ${formatFileSize(maxSize)}`);
        return false;
      }
      
      if (acceptedTypes[0] !== '*/*') {
        const fileType = file.type || '';
        const isAccepted = acceptedTypes.some(type => {
          if (type.endsWith('/*')) {
            const category = type.split('/')[0];
            return fileType.startsWith(`${category}/`);
          }
          return type === fileType;
        });
        
        if (!isAccepted) {
          setError('File type not accepted');
          return false;
        }
      }
    }
    
    setError(null);
    return true;
  };
  
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);
  
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const { files } = e.dataTransfer;
    const fileArray = Array.from(files);
    
    if (validateFiles(fileArray)) {
      onFilesSelected(fileArray);
    }
  }, [onFilesSelected, validateFiles]);
  
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files) {
      const fileArray = Array.from(files);
      
      if (validateFiles(fileArray)) {
        onFilesSelected(fileArray);
      }
    }
  }, [onFilesSelected, validateFiles]);
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <div className="w-full">
      <div
        className={cn(
          "drop-zone",
          isDragActive ? "drop-zone-active" : "drop-zone-idle"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          id="file-upload"
          type="file"
          className="sr-only"
          multiple
          onChange={handleFileInputChange}
          accept={acceptedTypes.join(',')}
        />
        
        <label htmlFor="file-upload" className="w-full cursor-pointer">
          <div className="flex flex-col items-center justify-center py-4">
            <div className="rounded-full bg-primary/10 p-3 mb-3">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <p className="font-medium text-center">
              Drag files here or click to upload
            </p>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              Upload up to {maxFiles} files (max {formatFileSize(maxSize)} each)
            </p>
            {error && (
              <p className="text-sm text-destructive mt-2">
                {error}
              </p>
            )}
          </div>
        </label>
      </div>
    </div>
  );
};
