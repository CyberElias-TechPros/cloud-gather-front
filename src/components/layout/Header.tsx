
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Bell, 
  Crown, 
  HelpCircle, 
  LogOut, 
  Menu, 
  Plus, 
  Search, 
  Settings, 
  User, 
  Users 
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useIsMobile } from '@/hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';

interface HeaderProps {
  title: string;
  sidebarOpen: boolean;
  onSidebarToggle: () => void;
}

export const Header = ({ title, sidebarOpen, onSidebarToggle }: HeaderProps) => {
  const isMobile = useIsMobile();
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');

  const hasNotifications = notifications.length > 0;

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
          <Input 
            type="text" 
            placeholder="Search files..." 
            className="bg-transparent border-none outline-none w-40 lg:w-64 text-sm h-7 p-0 focus-visible:ring-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground relative">
              <Bell className="h-5 w-5" />
              {hasNotifications && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  {notifications.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                Stay updated on your cloud storage activities.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notification) => (
                    <div key={notification.id} className="p-3 rounded-lg border border-border">
                      {notification.content}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="primary" size="sm" className="hidden md:flex">
              <Plus className="h-4 w-4 mr-1" /> 
              Add File
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Upload Files</SheetTitle>
              <SheetDescription>
                Choose files to upload to your cloud storage.
              </SheetDescription>
            </SheetHeader>
            <div className="py-4">
              <div className="drop-zone drop-zone-idle hover:drop-zone-active text-center">
                <div className="my-6">
                  <div className="bg-muted rounded-full p-3 mx-auto w-fit mb-3">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="font-medium mb-1">Drop files here or click to browse</p>
                  <p className="text-sm text-muted-foreground">
                    Maximum file size: 100MB
                  </p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="hidden md:flex text-muted-foreground">
              <Crown className="h-4 w-4 mr-1.5 text-yellow-500" />
              Upgrade
              <span className="sr-only">Upgrade plan</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[280px]">
            <DropdownMenuLabel>Subscription Plans</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-2">
              <div className="rounded-lg border p-3 mb-2">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Premium</h3>
                  <Badge variant="outline" className="bg-primary/10 text-primary">$5/mo</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Unlimited providers, advanced features</p>
                <Button className="w-full">Upgrade to Premium</Button>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">Business</h3>
                  <Badge variant="outline" className="bg-primary/10 text-primary">$15/mo</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">Team collaboration, admin controls</p>
                <Button className="w-full">Upgrade to Business</Button>
              </div>
            </div>
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
            <div className="flex items-center justify-start p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium">Username</p>
                <p className="w-[200px] truncate text-sm text-muted-foreground">
                  user@example.com
                </p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/team">
                  <Users className="mr-2 h-4 w-4" />
                  <span>Team</span>
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/help">
                <HelpCircle className="mr-2 h-4 w-4" />
                <span>Help & Support</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/logout">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

// Upload icon component
function Upload(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
