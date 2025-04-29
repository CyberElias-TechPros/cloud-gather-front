
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { 
  FileText, 
  FolderOpen, 
  HardDrive, 
  Settings, 
  ClipboardList, 
  Clock, 
  Users,
  Cloud,
  Code,
  LogOut,
  User,
  Menu,
  Star,
  Share2,
  Trash,
  LayoutDashboard,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ open, onToggle }: SidebarProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const NavItem = ({ to, icon: Icon, label, count }: { 
    to: string; 
    icon: React.ElementType; 
    label: string;
    count?: number;
  }) => {
    const active = isActive(to);
    
    return (
      <NavLink to={to} className="block">
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {open && (
                <div className="flex-1 flex justify-between items-center">
                  <span>{label}</span>
                  {count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {count}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </TooltipTrigger>
          {!open && <TooltipContent side="right">{label}</TooltipContent>}
        </Tooltip>
      </NavLink>
    );
  };

  const Header = () => (
    <div className={cn(
      "flex h-14 items-center px-4",
      open ? "justify-between" : "justify-center"
    )}>
      {open && (
        <div className="flex items-center gap-2">
          <Cloud className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Cloud Edifix</span>
        </div>
      )}
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        className={cn("rounded-full", !open && "mx-auto")}
        aria-label={open ? "Close sidebar" : "Open sidebar"}
      >
        {open ? <ChevronsLeft className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
      </Button>
    </div>
  );

  const UserSection = () => {
    if (!user) return null;
    
    return (
      <div className={cn(
        "mt-auto p-4",
        open ? "flex items-center justify-between" : "flex flex-col items-center space-y-2"
      )}>
        <div className={cn(
          "flex items-center gap-2",
          !open && "flex-col"
        )}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.user_metadata?.avatar_url} />
            <AvatarFallback>
              {user.email?.charAt(0).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          {open && (
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {user.user_metadata?.name || user.email?.split('@')[0] || 'User'}
              </span>
              {user.email && (
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {user.email}
                </span>
              )}
            </div>
          )}
        </div>
        
        {open ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="h-8 w-8"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        ) : (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="h-8 w-8"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  const sidebarClasses = cn(
    "flex flex-col border-r bg-background h-full transition-all duration-300",
    open ? "w-64" : "w-[56px]"
  );

  return (
    <div className={sidebarClasses}>
      <Header />
      
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 py-2">
          <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/files" icon={FileText} label="My Files" />
          <NavItem to="/recents" icon={Clock} label="Recent Files" />
          <NavItem to="/storage" icon={HardDrive} label="Storage" />
          <NavItem to="/providers" icon={Cloud} label="Providers" />
        </div>
        
        {open && <Separator className="my-2" />}
        
        <div className="space-y-1 py-2">
          <NavItem to="/team" icon={Users} label="Team" />
          <NavItem to="/settings" icon={Settings} label="Settings" />
          <NavItem to="/api-docs" icon={Code} label="API Docs" />
        </div>
        
        {open && <Separator className="my-2" />}
        
        <div className="space-y-1 py-2">
          <NavItem to="/help" icon={HelpCircle} label="Help & Support" />
        </div>
      </ScrollArea>
      
      <Separator />
      <UserSection />
    </div>
  );
};
