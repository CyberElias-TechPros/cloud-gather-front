import React from "react";
import { useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CloudOff, Home, Search } from "lucide-react";
import { MarketingLayout } from "@/components/layout/MarketingLayout";
import { Seo } from "@/components/common/Seo";

const NotFound: React.FC = () => {
  const location = useLocation();

  return (
    <MarketingLayout>
      <Seo
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
        noIndex
      />
      <div className="flex items-center justify-center py-24">
        <div className="mx-auto max-w-lg p-6 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <CloudOff className="h-10 w-10 text-primary" aria-hidden="true" />
          </div>
          <h1 className="mb-2 text-4xl font-bold">404</h1>
          <h2 className="mb-4 text-xl font-semibold">Page not found</h2>
          <p className="mb-8 text-muted-foreground">
            We couldn&apos;t find <code className="rounded-sm bg-muted px-1.5 py-0.5 text-sm">{location.pathname}</code>.
            It may have been moved, or the link might be out of date.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/">
                <Home className="mr-2 h-4 w-4" aria-hidden="true" /> Back to home
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/features">
                <Search className="mr-2 h-4 w-4" aria-hidden="true" /> Explore features
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
};

export default NotFound;
