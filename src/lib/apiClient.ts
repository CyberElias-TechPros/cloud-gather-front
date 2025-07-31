import { supabase } from '@/integrations/supabase/client';
import { FileItem, ApiKey } from '@/types/file';
import { errorHandler, ErrorCode } from '@/lib/error/ErrorHandler';
import { RateLimiter } from '@/lib/security/rateLimiter';

const rateLimiter = new RateLimiter(100, 60000); // 100 requests per minute

/**
 * A client for the CloudUnity API with enhanced security and error handling
 */
export class ApiClient {
  private apiKey: string | null = null;
  public baseUrl: string;

  constructor(baseUrl: string = 'https://api.cloudunity.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Clear the API key
   */
  clearApiKey(): void {
    this.apiKey = null;
  }

  /**
   * Check if an API key is set
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Make an API request with enhanced error handling and rate limiting
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    isFormData: boolean = false
  ): Promise<T> {
    if (!this.apiKey) {
      throw errorHandler.handleError(new Error('API key not set'), {
        operation: 'api_request',
        path,
        method,
      });
    }

    // Check rate limit
    const rateLimitResult = rateLimiter.isAllowed(this.apiKey);
    if (!rateLimitResult.allowed) {
      throw errorHandler.handleError(new Error('API rate limit exceeded'), {
        operation: 'api_request',
        path,
        method,
        resetTime: rateLimitResult.resetTime,
      });
    }

    const headers: Record<string, string> = {
      'x-api-key': this.apiKey,
    };

    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }

    const options: RequestInit = {
      method,
      headers,
      // Add timeout
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };

    if (data) {
      if (isFormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, options);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: response.statusText };
        }
        
        const error = new Error(errorData.error || 'API request failed');
        throw errorHandler.handleError(error, {
          operation: 'api_request',
          path,
          method,
          status: response.status,
          statusText: response.statusText,
        });
      }

      // For file downloads, return the response directly
      if (response.headers.get('Content-Type')?.includes('application/octet-stream')) {
        return response as unknown as T;
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw errorHandler.handleError(new Error('Request timeout'), {
          operation: 'api_request',
          path,
          method,
        });
      }
      throw error;
    }
  }

  // File Operations

  /**
   * List files in a folder
   */
  async listFiles(
    folderId: string | null = null,
    sortBy: 'name' | 'date' | 'size' = 'name',
    sortDirection: 'asc' | 'desc' = 'asc'
  ): Promise<{ files: FileItem[] }> {
    let path = '/api/v1/files';
    const params = new URLSearchParams();
    
    if (folderId) {
      params.append('folder', folderId);
    }
    
    params.append('sort', sortBy);
    params.append('direction', sortDirection);
    
    path += `?${params.toString()}`;
    
    return this.request<{ files: FileItem[] }>('GET', path);
  }

  /**
   * Get file metadata
   */
  async getFile(fileId: string): Promise<{ file: FileItem }> {
    return this.request<{ file: FileItem }>('GET', `/api/v1/files/${fileId}`);
  }

  /**
   * Download a file
   */
  async downloadFile(fileId: string): Promise<Response> {
    return this.request<Response>('GET', `/api/v1/files/${fileId}/download`);
  }

  /**
   * Create a new folder
   */
  async createFolder(
    folderName: string,
    parentFolderId: string | null = null
  ): Promise<{ folder: FileItem }> {
    return this.request<{ folder: FileItem }>('POST', '/api/v1/files/folder', {
      folderName,
      parentFolderId,
    });
  }

  /**
   * Upload a file
   */
  async uploadFile(
    file: File,
    parentFolderId: string | null = null
  ): Promise<{ file: FileItem }> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (parentFolderId) {
      formData.append('parentFolderId', parentFolderId);
    }
    
    return this.request<{ file: FileItem }>('POST', '/api/v1/files/upload', formData, true);
  }

  /**
   * Delete a file or folder
   */
  async deleteFile(fileId: string): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('DELETE', `/api/v1/files/${fileId}`);
  }

  /**
   * Share a file with someone
   */
  async shareFile(
    fileId: string,
    email: string,
    permissionLevel: 'view' | 'edit' | 'admin' = 'view',
    expiresAt: string | null = null
  ): Promise<{ share: any }> {
    return this.request<{ share: any }>('POST', `/api/v1/files/${fileId}/share`, {
      email,
      permissionLevel,
      expiresAt,
    });
  }

  // Enhanced API Key Management with proper error handling

  /**
   * List API keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    try {
      const { data, error } = await supabase.functions.invoke('api-key-management', {
        method: 'GET',
      });
      
      if (error) {
        throw errorHandler.handleError(new Error(error.message), {
          operation: 'list_api_keys',
        });
      }
      
      return data.keys || [];
    } catch (error) {
      throw errorHandler.handleError(error as Error, {
        operation: 'list_api_keys',
      });
    }
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    name: string,
    permissions: string[] = ['read']
  ): Promise<{ apiKey: ApiKey & { key: string } }> {
    try {
      const { data, error } = await supabase.functions.invoke('api-key-management', {
        method: 'POST',
        body: {
          name,
          permissions,
          expiresAt: null,
        },
      });
      
      if (error) {
        throw errorHandler.handleError(new Error(error.message), {
          operation: 'create_api_key',
          name,
          permissions,
        });
      }
      
      return data;
    } catch (error) {
      throw errorHandler.handleError(error as Error, {
        operation: 'create_api_key',
        name,
        permissions,
      });
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('api-key-management', {
        method: 'DELETE',
        body: { id: keyId },
      });
      
      if (error) {
        throw errorHandler.handleError(new Error(error.message), {
          operation: 'revoke_api_key',
          keyId,
        });
      }
      
      return { success: true };
    } catch (error) {
      throw errorHandler.handleError(error as Error, {
        operation: 'revoke_api_key',
        keyId,
      });
    }
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
