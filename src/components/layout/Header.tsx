
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bell, Menu, Plus, Search, Settings } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';

interface HeaderProps {
  title: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}

export const Header = ({ title, sidebarOpen, onSidebarToggle }: HeaderProps) => {
  const isMobile = useIsMobile();

  return (
    <header className="bg-white border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center">
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={onSidebarToggle} className="mr-2">
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="hidden md:flex items-center bg-muted rounded-full px-3 py-1.5">
          <Search className="h-4 w-4 text-muted-foreground mr-2" />
          <input 
            type="text" 
            placeholder="Search files..." 
            className="bg-transparent outline-none w-40 lg:w-64 text-sm"
          />
        </div>

        <Button variant="ghost" size="icon" className="text-muted-foreground">
          <Bell className="h-5 w-5" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Settings className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Settings</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Account</DropdownMenuItem>
            <DropdownMenuItem>Appearance</DropdownMenuItem>
            <DropdownMenuItem>Notifications</DropdownMenuItem>
            <DropdownMenuItem>Security</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src="" alt="User" />
              <AvatarFallback className="bg-primary text-primary-foreground">NU</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Subscription</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
