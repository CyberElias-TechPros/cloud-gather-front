import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  Users,
  CreditCard,
  Webhook,
  Bell,
  MailWarning,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AnnouncementBanner } from "@/components/common/AnnouncementBanner";
import { useAppConfig } from "@/hooks/useAppConfig";
import { sendVerificationEmail } from "@/services/account";
import { errorMessage } from "@/lib/api";

interface AppLayoutProps {
  children: React.ReactNode;
}

const navigationItems = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Files", href: "/files", icon: FolderOpen },
  { name: "Shared", href: "/shared", icon: Users },
  { name: "Recent", href: "/recents", icon: Clock },
  { name: "Storage", href: "/storage", icon: HardDrive },
  { name: "Providers", href: "/providers", icon: Cloud },
];

/**
 * Chrome for authenticated app pages: brand link, primary navigation
 * (responsive drawer on mobile), notifications and the account menu.
 */
export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: config } = useAppConfig();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [resending, setResending] = React.useState(false);

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
  const plan = user?.plan && user.plan !== "free" ? user.plan : null;
  const needsVerification = Boolean(
    config?.policy?.require_email_verification && user && user.email_verified === false,
  );

  const navClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  const NavList: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => (
    <nav aria-label="Application" className="flex flex-col gap-1 lg:flex-row lg:items-center">
      {navigationItems.map((item) => (
        <NavLink key={item.href} to={item.href} className={navClass} onClick={onNavigate}>
          <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {item.name}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/admin" className={navClass} onClick={onNavigate}>
          <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
          Admin
        </NavLink>
      )}
    </nav>
  );

  const resend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      toast.success("Verification email sent — check your inbox.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <AnnouncementBanner />

      {needsVerification ? (
        <div className="flex flex-wrap items-center gap-3 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
          <MailWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="flex-1 leading-snug">
            Confirm your email address to unlock sharing, uploads and billing.
          </p>
          <Button size="sm" variant="outline" onClick={resend} disabled={resending}>
            {resending ? "Sending…" : "Resend email"}
          </Button>
        </div>
      ) : null}

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
                <div className="mt-4 flex flex-col gap-1">
                  <NavList onNavigate={() => setMobileOpen(false)} />
                  <div className="my-2 border-t" />
                  <NavLink to="/settings" className={navClass} onClick={() => setMobileOpen(false)}>
                    <Settings className="h-4 w-4 shrink-0" aria-hidden="true" /> Settings
                  </NavLink>
                  <NavLink to="/api-keys" className={navClass} onClick={() => setMobileOpen(false)}>
                    <KeyRound className="h-4 w-4 shrink-0" aria-hidden="true" /> API keys
                  </NavLink>
                  <NavLink to="/webhooks" className={navClass} onClick={() => setMobileOpen(false)}>
                    <Webhook className="h-4 w-4 shrink-0" aria-hidden="true" /> Webhooks
                  </NavLink>
                  <NavLink to="/billing" className={navClass} onClick={() => setMobileOpen(false)}>
                    <CreditCard className="h-4 w-4 shrink-0" aria-hidden="true" /> Billing
                  </NavLink>
                  <NavLink to="/notifications" className={navClass} onClick={() => setMobileOpen(false)}>
                    <Bell className="h-4 w-4 shrink-0" aria-hidden="true" /> Notifications
                  </NavLink>
                </div>
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

          <div className="flex items-center gap-1">
            <NotificationBell />
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
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel>
                  <div className="truncate text-sm font-medium">{user?.email}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{plan ?? "Free"} plan</Badge>
                    {isAdmin ? <Badge variant="outline">Admin</Badge> : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" /> Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/billing")}>
                  <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" /> Plan &amp; billing
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/api-keys")}>
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" /> API keys
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/webhooks")}>
                  <Webhook className="mr-2 h-4 w-4" aria-hidden="true" /> Webhooks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/notifications")}>
                  <Bell className="mr-2 h-4 w-4" aria-hidden="true" /> Notifications
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
            <Link to="/status" className="hover:text-foreground">Status</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/contact" className="hover:text-foreground">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
