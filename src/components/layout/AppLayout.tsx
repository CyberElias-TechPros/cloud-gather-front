import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Menu,
  Home,
  FolderOpen,
  HardDrive,
  Settings,
  Clock,
  Cloud,
  LogOut,
  KeyRound,
  Shield,
  LifeBuoy,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Files", href: "/files", icon: FolderOpen },
  { name: "Storage", href: "/storage", icon: HardDrive },
  { name: "Providers", href: "/providers", icon: Cloud },
  { name: "Recent", href: "/recents", icon: Clock },
  { name: "API keys", href: "/api-keys", icon: KeyRound },
  { name: "Settings", href: "/settings", icon: Settings },
];

/**
 * Chrome for authenticated app pages: brand link, primary navigation
 * (responsive drawer on mobile) and the account menu.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success("Signed out");
      navigate("/");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Account";
  const initials = displayName.slice(0, 2).toUpperCase();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  const NavList: React.FC = () => (
    <nav aria-label="Application" className="flex flex-col gap-1">
      {navigationItems.map((item) => (
        <NavLink key={item.href} to={item.href} className={navClass}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {item.name}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/admin" className={navClass}>
          <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
          Admin
        </NavLink>
      )}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted lg:hidden"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle>
                    <Logo />
                  </SheetTitle>
                </SheetHeader>
                <NavList />
              </SheetContent>
            </Sheet>

            <Link to="/dashboard" aria-label={`${siteConfig.name} dashboard`} className="hidden rounded-md lg:block">
              <Logo />
            </Link>
            <div className="lg:hidden">
              <Link to="/dashboard" aria-label={`${siteConfig.name} dashboard`}>
                <LogoMark className="h-8 w-8" />
              </Link>
            </div>

            {/* Desktop nav */}
            <div className="hidden lg:block">
              <NavList />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full p-1 pr-2 transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">
                    {displayName}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-medium">{user?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/api-keys")}>
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" /> API keys
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/contact")}>
                  <LifeBuoy className="mr-2 h-4 w-4" aria-hidden="true" /> Help &amp; support
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <Shield className="mr-2 h-4 w-4" aria-hidden="true" /> Admin console
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main id="main-content" className="container flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>

      <footer className="border-t py-4">
        <div className="container flex items-center justify-between px-4 text-xs text-muted-foreground sm:px-6">
          <p>© {new Date().getFullYear()} {siteConfig.name}</p>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/contact" className="hover:text-foreground">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
