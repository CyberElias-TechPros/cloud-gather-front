
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronRight, Home } from 'lucide-react';

interface FileBreadcrumbProps {
  currentPath: string[];
  onNavigate: (index: number) => void;
}

export const FileBreadcrumb = ({ currentPath, onNavigate }: FileBreadcrumbProps) => {
  return (
    <nav className="flex items-center mb-6 overflow-x-auto">
      {currentPath.map((path, index) => (
        <React.Fragment key={index}>
          {index > 0 && <ChevronRight className="h-4 w-4 mx-1 text-muted-foreground" />}
          <Button
            variant={index === currentPath.length - 1 ? 'secondary' : 'ghost'}
            size="sm"
            className="flex items-center"
            onClick={() => onNavigate(index)}
          >
            {index === 0 ? <Home className="h-4 w-4 mr-1" /> : null}
            <span className="truncate max-w-[200px]">{path}</span>
          </Button>
        </React.Fragment>
      ))}
    </nav>
  );
};
