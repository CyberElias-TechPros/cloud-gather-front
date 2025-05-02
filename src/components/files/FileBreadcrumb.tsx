
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home } from 'lucide-react';
import { FileItem } from '@/types/file';

interface FileBreadcrumbProps {
  path: FileItem[];
  currentPath?: string[]; // Keep the old prop for backward compatibility
  onNavigate: (index: number) => void;
}

export const FileBreadcrumb = ({ path, currentPath, onNavigate }: FileBreadcrumbProps) => {
  const pathToUse = path || currentPath || [];
  
  return (
    <nav className="flex items-center mb-6 overflow-x-auto">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center"
        onClick={() => onNavigate(-1)}
      >
        <Home className="h-4 w-4 mr-1" />
        <span>Home</span>
      </Button>
      
      {pathToUse.map((item, index) => (
        <React.Fragment key={index}>
          <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />
          <Button
            variant={index === pathToUse.length - 1 ? 'secondary' : 'ghost'}
            size="sm"
            className="flex items-center"
            onClick={() => onNavigate(index)}
          >
            <span className="truncate max-w-[200px]">
              {typeof item === 'string' ? item : item.filename}
            </span>
          </Button>
        </React.Fragment>
      ))}
    </nav>
  );
};
