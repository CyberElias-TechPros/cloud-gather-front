
import React from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface FileBreadcrumbProps {
  currentPath: string[];
  onNavigate: (index: number) => void;
}

export const FileBreadcrumb = ({ currentPath, onNavigate }: FileBreadcrumbProps) => {
  return (
    <div className="mb-6">
      <Breadcrumb>
        {currentPath.map((path, index) => (
          <React.Fragment key={path}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => onNavigate(index)}
                className="cursor-pointer"
              >
                {path}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </Breadcrumb>
    </div>
  );
};
