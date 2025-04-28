
import { supabase } from '@/integrations/supabase/client';
import { FileItem, ApiKey } from '@/types/file';

/**
 * A client for the CloudUnity API
 */
export class ApiClient {
  private apiKey: string | null = null;
  private baseUrl: string;

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
   * Make an API request
   */
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    isFormData: boolean = false
  ): Promise<T> {
    if (!this.apiKey) {
      throw new Error('API key not set');
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
    };

    if (data) {
      if (isFormData) {
        options.body = data;
      } else {
        options.body = JSON.stringify(data);
      }
    }

    const response = await fetch(`${this.baseUrl}${path}`, options);
    
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }
      throw new Error(errorData.error || 'API request failed');
    }

    // For file downloads, return the response directly
    if (response.headers.get('Content-Type')?.includes('application/octet-stream')) {
      return response as unknown as T;
    }

    return response.json();
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

  // API Key Management - These methods use direct Supabase function calls

  /**
   * List API keys
   */
  async listApiKeys(): Promise<ApiKey[]> {
    const { data, error } = await supabase.functions.invoke('api-key-management', {
      method: 'GET',
    });
    
    if (error) throw new Error(error.message);
    return data.keys || [];
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    name: string,
    permissions: string[] = ['read']
  ): Promise<{ apiKey: ApiKey & { key: string } }> {
    const { data, error } = await supabase.functions.invoke('api-key-management', {
      method: 'POST',
      body: {
        name,
        permissions,
        expiresAt: null,
      },
    });
    
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<{ success: boolean }> {
    const { data, error } = await supabase.functions.invoke('api-key-management', {
      method: 'DELETE',
      body: { id: keyId },
    });
    
    if (error) throw new Error(error.message);
    return { success: true };
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
