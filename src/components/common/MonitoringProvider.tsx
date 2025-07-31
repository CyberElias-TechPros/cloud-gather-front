import React, { useEffect } from 'react';
import { useMonitoring } from '@/hooks/useMonitoring';

interface MonitoringProviderProps {
  children: React.ReactNode;
}

export const MonitoringProvider: React.FC<MonitoringProviderProps> = ({ children }) => {
  const { recordActivity } = useMonitoring();

  useEffect(() => {
    // Record app initialization
    recordActivity('app_init', 'application');

    // Global error handler for unhandled errors
    const handleError = (event: ErrorEvent) => {
      recordActivity('unhandled_error', 'error', event.filename, false, { message: event.message });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      recordActivity('unhandled_promise_rejection', 'error', undefined, false, { reason: event.reason?.toString() });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [recordActivity]);

  return <>{children}</>;
};