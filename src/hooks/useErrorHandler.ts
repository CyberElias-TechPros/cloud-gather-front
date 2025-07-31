
import { useCallback } from 'react';
import { errorHandler, ErrorCode, AppError } from '@/lib/error/ErrorHandler';

export const useErrorHandler = () => {
  const handleError = useCallback((error: Error | AppError, context?: Record<string, any>) => {
    return errorHandler.handleError(error, context);
  }, []);

  const handleAsyncError = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<{ data?: T; error?: AppError }> => {
    try {
      const data = await operation();
      return { data };
    } catch (error) {
      const appError = handleError(error as Error, context);
      return { error: appError };
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError,
    getRecentErrors: errorHandler.getRecentErrors.bind(errorHandler),
    clearErrorLog: errorHandler.clearErrorLog.bind(errorHandler),
  };
};
