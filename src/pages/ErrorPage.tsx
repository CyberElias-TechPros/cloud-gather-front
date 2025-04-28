
import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const ErrorPage = () => {
  const navigate = useNavigate();

  return (
    <AppLayout title="Error">
      <div className="flex flex-col items-center justify-center h-[70vh] text-center">
        <h1 className="text-4xl font-bold mb-4">Oops! Something went wrong</h1>
        <p className="text-lg text-muted-foreground mb-8">
          We encountered an error while processing your request.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate('/')}>
            Return to Dashboard
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default ErrorPage;
