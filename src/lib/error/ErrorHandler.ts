import { toast } from 'sonner';

export enum ErrorCode {
  // Authentication errors
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  
  // Permission errors
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // File operation errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  
  // Provider errors
  PROVIDER_CONNECTION_FAILED = 'PROVIDER_CONNECTION_FAILED',
  PROVIDER_QUOTA_EXCEEDED = 'PROVIDER_QUOTA_EXCEEDED',
  
  // Unknown error
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  context?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle and log an error
   */
  handleError(error: Error | AppError, context?: Record<string, any>): AppError {
    const appError: AppError = this.normalizeError(error, context);
    
    // Log the error
    this.logError(appError);
    
    // Show user-friendly message
    this.showUserMessage(appError);
    
    return appError;
  }

  /**
   * Normalize different error types into AppError
   */
  private normalizeError(error: Error | AppError, context?: Record<string, any>): AppError {
    if ('code' in error && 'timestamp' in error) {
      return error as AppError;
    }

    // Convert regular Error to AppError
    const message = error.message || 'An unknown error occurred';
    let code = ErrorCode.UNKNOWN_ERROR;

    // Map common error patterns to specific codes
    if (message.includes('authentication') || message.includes('unauthorized')) {
      code = ErrorCode.AUTH_REQUIRED;
    } else if (message.includes('permission') || message.includes('forbidden')) {
      code = ErrorCode.PERMISSION_DENIED;
    } else if (message.includes('validation') || message.includes('invalid')) {
      code = ErrorCode.VALIDATION_ERROR;
    } else if (message.includes('network') || message.includes('connection')) {
      code = ErrorCode.NETWORK_ERROR;
    } else if (message.includes('timeout')) {
      code = ErrorCode.TIMEOUT_ERROR;
    } else if (message.includes('rate limit')) {
      code = ErrorCode.RATE_LIMIT_EXCEEDED;
    } else if (message.includes('quota') || message.includes('storage')) {
      code = ErrorCode.STORAGE_QUOTA_EXCEEDED;
    }

    return {
      code,
      message,
      details: error.stack,
      timestamp: new Date(),
      context,
    };
  }

  /**
   * Log error for debugging and monitoring
   */
  private logError(error: AppError): void {
    console.error('Application Error:', {
      code: error.code,
      message: error.message,
      timestamp: error.timestamp,
      context: error.context,
      details: error.details,
    });

    // Store in memory (in production, you'd send to logging service)
    this.errorLog.push(error);
    
    // Keep only last 100 errors in memory
    if (this.errorLog.length > 100) {
      this.errorLog.shift();
    }
  }

  /**
   * Show user-friendly error message
   */
  private showUserMessage(error: AppError): void {
    const userMessages: Record<ErrorCode, string> = {
      [ErrorCode.AUTH_REQUIRED]: 'Please log in to continue',
      [ErrorCode.AUTH_EXPIRED]: 'Your session has expired. Please log in again',
      [ErrorCode.AUTH_INVALID]: 'Invalid credentials',
      [ErrorCode.PERMISSION_DENIED]: 'You don\'t have permission to perform this action',
      [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
      [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again',
      [ErrorCode.INVALID_INPUT]: 'Invalid input provided',
      [ErrorCode.FILE_NOT_FOUND]: 'File not found',
      [ErrorCode.FILE_TOO_LARGE]: 'File is too large',
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]: 'Storage quota exceeded',
      [ErrorCode.UPLOAD_FAILED]: 'File upload failed',
      [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection',
      [ErrorCode.TIMEOUT_ERROR]: 'Request timed out. Please try again',
      [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Too many requests. Please wait a moment',
      [ErrorCode.SERVER_ERROR]: 'Server error. Please try again later',
      [ErrorCode.DATABASE_ERROR]: 'Database error. Please try again',
      [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
      [ErrorCode.PROVIDER_CONNECTION_FAILED]: 'Failed to connect to storage provider',
      [ErrorCode.PROVIDER_QUOTA_EXCEEDED]: 'Storage provider quota exceeded',
      [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred',
    };

    const userMessage = userMessages[error.code] || error.message;
    toast.error(userMessage);
  }

  /**
   * Get recent errors for debugging
   */
  getRecentErrors(limit: number = 20): AppError[] {
    return this.errorLog.slice(-limit);
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }
}

// Global error handler instance
export const errorHandler = ErrorHandler.getInstance();

// Utility function for handling async operations
export const handleAsync = async <T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ data?: T; error?: AppError }> => {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    const appError = errorHandler.handleError(error as Error, context);
    return { error: appError };
  }
};
