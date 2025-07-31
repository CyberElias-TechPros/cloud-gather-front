
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Menu,
  Home,
  FolderOpen,
  HardDrive,
  Settings,
  Users,
  BookOpen,
  Clock,
  Cloud,
  LogOut,
  User,
  Shield,
  Bell,
  Search,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
}

const navigationItems = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Files', href: '/files', icon: FolderOpen },
  { name: 'Storage', href: '/storage', icon: HardDrive },
  { name: 'Providers', href: '/providers', icon: Cloud },
  { name: 'Recent', href: '/recents', icon: Clock },
  { name: 'Team', href: '/team', icon: Users },
  { name: 'API Docs', href: '/api-docs', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const AppLayout: React.FC<AppLayoutProps> = ({ 
  children, 
  title,
  showSearch = false 
}) => {
  const { user, profile, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  const isCurrentPath = (path: string) => {
    return location.pathname === path;
  };

  const userInitials = profile?.display_name 
    ? profile.display_name.split(' ').map(n => n[0]).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || '?';

  const Sidebar = ({ mobile = false }) => (
    <div className={`flex flex-col h-full ${mobile ? 'px-4' : ''}`}>
      <div className={`flex items-center ${mobile ? 'justify-start py-4' : 'justify-center py-6 px-4'} border-b`}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Cloud className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className={`font-bold text-lg ${mobile ? '' : 'hidden lg:block'}`}>
            CloudEdifix
          </span>
        </div>
      </div>

      <nav className={`flex-1 overflow-y-auto ${mobile ? 'py-4' : 'py-6 px-3'}`}>
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const current = isCurrentPath(item.href);
            
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onClick={() => mobile && setMobileMenuOpen(false)}
                  className={`
                    flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150
                    ${current 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }
                  `}
                >
                  <Icon className={`h-5 w-5 ${mobile ? 'mr-3' : 'mr-3 lg:mr-3'} flex-shrink-0`} />
                  <span className={mobile ? '' : 'hidden lg:block'}>
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={`border-t ${mobile ? 'py-4' : 'py-4 px-3'}`}>
        <div className="flex items-center space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="text-sm">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <div className={`flex-1 min-w-0 ${mobile ? '' : 'hidden lg:block'}`}>
            <p className="text-sm font-medium text-foreground truncate">
              {profile?.display_name || user?.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              Free Plan
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-card border-r">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:pl-64">
        {/* Header */}
        <header className="bg-card border-b px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="md:hidden">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                        <Cloud className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span>CloudEdifix</span>
                    </SheetTitle>
                  </SheetHeader>
                  <Sidebar mobile />
                </SheetContent>
              </Sheet>

              {title && (
                <div>
                  <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {showSearch && (
                <div className="hidden sm:block relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="pl-10 pr-4 py-2 text-sm bg-muted rounded-md border-0 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              )}

              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-5 w-5" />
                <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs">
                  3
                </Badge>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url || undefined} />
                      <AvatarFallback>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {profile?.display_name || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
