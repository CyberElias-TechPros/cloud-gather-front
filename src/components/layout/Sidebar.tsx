
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  ChevronLeft, 
  ChevronRight, 
  Cloud, 
  FileText, 
  Grid, 
  HardDrive, 
  Home, 
  Plus, 
  Settings, 
  Share2, 
  Star, 
  Trash2, 
  Upload, 
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ open, onToggle }: SidebarProps) => {
  const location = useLocation();
  
  const mainLinks = [
    { label: 'Dashboard', icon: Home, path: '/' },
    { label: 'My Files', icon: FileText, path: '/files' },
    { label: 'Shared', icon: Share2, path: '/shared' },
    { label: 'Starred', icon: Star, path: '/starred' },
    { label: 'Recents', icon: Clock, path: '/recents' },
    { label: 'Team', icon: Users, path: '/team' },
  ];
  
  const storageLinks = [
    { label: 'Storage Manager', icon: HardDrive, path: '/storage' },
    { label: 'Providers', icon: Cloud, path: '/providers' },
  ];

  return (
    <div 
      className={cn(
        "bg-sidebar border-r border-border h-full flex flex-col transition-all duration-300",
        open ? "w-64" : "w-16"
      )}
    >
      <div className="flex items-center p-4 h-[61px]">
        <div className="flex items-center">
          <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
            <Cloud className="h-5 w-5" />
          </div>
          <span className={cn(
            "ml-2 text-lg font-bold transition-opacity",
            open ? "opacity-100" : "opacity-0"
          )}>
            CloudUnity
          </span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="ml-auto" 
          onClick={onToggle}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
        >
          {open ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>
      
      <div className={cn(
        "mx-3 my-3 p-2 rounded-lg bg-primary/10 flex items-center justify-center transition-all", 
        open ? "px-3" : "px-2"
      )}>
        <Upload className="h-5 w-5 text-primary flex-shrink-0" />
        <span className={cn(
          "ml-2 font-medium transition-opacity text-primary",
          open ? "opacity-100" : "opacity-0 w-0"
        )}>
          Upload New
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <nav className="px-3 py-2">
          <ul className="space-y-1">
            {mainLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                    location.pathname === link.path
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <link.icon className={cn("h-5 w-5 flex-shrink-0", 
                    location.pathname === link.path ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "ml-3 transition-opacity",
                    open ? "opacity-100" : "opacity-0 hidden"
                  )}>
                    {link.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          
          <Separator className="my-4" />
          
          <div className={cn("mb-2 px-3 text-xs font-semibold text-muted-foreground", 
            open ? "" : "sr-only"
          )}>
            STORAGE
          </div>
          <ul className="space-y-1">
            {storageLinks.map((link) => (
              <li key={link.path}>
                <Link
                  to={link.path}
                  className={cn(
                    "flex items-center px-3 py-2 rounded-md text-sm font-medium",
                    location.pathname === link.path
                      ? "bg-primary/10 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <link.icon className={cn("h-5 w-5 flex-shrink-0", 
                    location.pathname === link.path ? "text-primary" : "text-muted-foreground"
                  )} />
                  <span className={cn(
                    "ml-3 transition-opacity",
                    open ? "opacity-100" : "opacity-0 hidden"
                  )}>
                    {link.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      
      <div className={cn("p-4", open ? "block" : "hidden")}>
        <div className="space-y-1">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Storage Used</span>
            <span className="font-medium">67%</span>
          </div>
          <Progress value={67} className="h-2" />
          <div className="text-xs text-muted-foreground">
            14.5 GB of 20 GB used
          </div>
        </div>
      </div>
      
      <div className="p-3 border-t border-border">
        <Link to="/settings">
          <div className={cn(
            "flex items-center px-3 py-2 rounded-md text-sm font-medium",
            location.pathname === '/settings'
              ? "bg-primary/10 text-primary"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}>
            <Settings className={cn("h-5 w-5 flex-shrink-0", 
              location.pathname === '/settings' ? "text-primary" : "text-muted-foreground"
            )} />
            <span className={cn(
              "ml-3 transition-opacity",
              open ? "opacity-100" : "opacity-0 hidden"
            )}>
              Settings
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
};

// Clock icon component
function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
