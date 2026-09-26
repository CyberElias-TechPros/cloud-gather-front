import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { mainNav, footerNav, siteConfig } from "@/lib/site";
import { NewsletterForm } from "@/components/common/NewsletterForm";
import { cn } from "@/lib/utils";

/**
 * Shared layout for all public, indexable marketing pages:
 * sticky header, responsive navigation and a consistent footer.
 */
export const MarketingLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
      isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
    );

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Logo />
            <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
              {mainNav.map((item) => (
                <NavLink key={item.href} to={item.href} className={navLinkClass} end={false}>
                  {item.title}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Button onClick={() => navigate("/dashboard")}>
                Open dashboard <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate("/login")}>
                  Sign in
                </Button>
                <Button onClick={() => navigate("/register")}>Get started free</Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted md:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>

        {mobileOpen && (
          <nav id="mobile-nav" aria-label="Mobile" className="border-t bg-background px-4 pb-4 pt-2 md:hidden">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {item.title}
              </Link>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t pt-3">
              {user ? (
                <Button onClick={() => { setMobileOpen(false); navigate("/dashboard"); }}>Open dashboard</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => { setMobileOpen(false); navigate("/login"); }}>
                    Sign in
                  </Button>
                  <Button onClick={() => { setMobileOpen(false); navigate("/register"); }}>Get started free</Button>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="border-t bg-muted/30">
        <div className="container px-4 py-12 sm:px-6">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="space-y-3">
              <Logo />
              <p className="max-w-xs text-sm text-muted-foreground">{siteConfig.tagline}. Bring every cloud storage account into one fast, private workspace.</p>
              <div className="max-w-xs pt-1">
                <h2 className="text-sm font-semibold">Product updates</h2>
                <p className="mb-2 text-xs text-muted-foreground">Occasional release notes. No spam, unsubscribe in one click.</p>
                <NewsletterForm source="footer" />
              </div>
            </div>
            {footerNav.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <h2 className="text-sm font-semibold">{group.title}</h2>
                <ul className="mt-3 space-y-2">
                  {group.links.map((link) => (
                    <li key={link.href + link.title}>
                      <Link to={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {link.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="mt-10 flex flex-col justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
            <p>Not affiliated with Google, Dropbox, Microsoft, Box or any other storage provider. Product names are trademarks of their respective owners.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
