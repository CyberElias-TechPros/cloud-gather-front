
import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CloudOff } from 'lucide-react';

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-6">
        <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CloudOff className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-muted-foreground mb-6">
          We couldn't find the page you were looking for. The path{' '}
          <code className="bg-muted px-1 py-0.5 rounded-sm text-red-500">
            {location.pathname}
          </code>{' '}
          doesn't exist or may have been moved.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Button asChild>
            <Link to="/">Go to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/files">Browse Files</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
