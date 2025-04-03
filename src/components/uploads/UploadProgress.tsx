import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { FileIcon, X, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadItem[];
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onClear?: (id: string) => void;
}

export const UploadProgress = ({ uploads, onCancel, onRetry, onClear }: UploadProgressProps) => {
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  if (uploads.length === 0) {
    return null;
  }
  
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="text-sm font-medium mb-3">
          File Uploads ({uploads.length})
        </div>
        
        <div className="space-y-3">
          {uploads.map((upload) => (
            <div key={upload.id} className="flex items-center">
              <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center mr-3">
                <FileIcon className="h-4 w-4 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-sm">
                  <span className="font-medium truncate" title={upload.fileName}>
                    {upload.fileName}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    {formatFileSize(upload.size)}
                  </span>
                </div>
                
                <div className="mt-1 flex items-center">
                  <Progress 
                    value={upload.progress} 
                    className={cn("h-1.5 flex-1", 
                      upload.status === 'error' ? 'bg-red-100' : 'bg-muted'
                    )} 
                  />
                  
                  <span className="ml-2 text-xs min-w-[40px] text-right">
                    {upload.status === 'success' ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : upload.status === 'error' ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      `${upload.progress}%`
                    )}
                  </span>
                </div>
                
                {upload.error && (
                  <div className="text-xs text-red-500 mt-1">
                    {upload.error}
                  </div>
                )}
              </div>
              
              <div className="ml-3">
                {upload.status === 'uploading' && onCancel && (
                  <Button variant="ghost" size="icon" onClick={() => onCancel(upload.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
                
                {upload.status === 'error' && onRetry && (
                  <Button variant="ghost" size="sm" onClick={() => onRetry(upload.id)}>
                    Retry
                  </Button>
                )}
                
                {(upload.status === 'success' || upload.status === 'error') && onClear && (
                  <Button variant="ghost" size="icon" onClick={() => onClear(upload.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
