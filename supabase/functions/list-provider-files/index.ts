
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Base Provider class
abstract class StorageProvider {
  protected provider: any;
  
  constructor(provider: any) {
    this.provider = provider;
  }
  
  abstract listFiles(
    folderId: string | null,
    page: number,
    limit: number,
    sortBy: string,
    sortDirection: string
  ): Promise<any[]>;
  
  getProviderType(): string {
    return this.provider.provider_name;
  }
}

// Google Drive implementation
class GoogleDriveProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    let url = 'https://www.googleapis.com/drive/v3/files';
    const pageToken = page > 1 ? `&pageToken=${(page - 1) * limit}` : '';
    
    const params = new URLSearchParams({
      fields: 'files(id,name,mimeType,size,modifiedTime,parents),nextPageToken',
      pageSize: limit.toString(),
      orderBy: `${sortBy} ${sortDirection}`
    });

    if (folderId) {
      params.append('q', `'${folderId}' in parents`);
    } else {
      params.append('q', `'root' in parents or parents = null`);
    }

    url = `${url}?${params.toString()}${pageToken}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.provider.access_token}` },
    });

    if (!response.ok) {
      console.error('Error fetching Google Drive files:', response.status);
      throw new Error('Failed to fetch files from Google Drive');
    }

    const data = await response.json();
    
    return data.files.map((file: any) => ({
      id: file.id,
      name: file.name,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      mimeType: file.mimeType,
      size: parseInt(file.size || '0'),
      modifiedTime: file.modifiedTime,
      path: `/${file.name}`, // This is simplified - would need recursive lookup for full path
    }));
  }
}

// Dropbox implementation
class DropboxProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    const path = folderId || '';
    
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.provider.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: path === '' ? '' : `/${path}`,
        recursive: false,
        include_media_info: true,
        include_deleted: false,
        limit: limit
      }),
    });

    if (!response.ok) {
      console.error('Error fetching Dropbox files:', response.status);
      throw new Error('Failed to fetch files from Dropbox');
    }

    const data = await response.json();
    
    return data.entries.map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      isFolder: entry['.tag'] === 'folder',
      mimeType: entry['.tag'] === 'file' ? entry.media_info?.metadata['.tag'] || 'application/octet-stream' : null,
      size: entry.size || 0,
      modifiedTime: entry.server_modified,
      path: entry.path_display,
    }));
  }
}

// OneDrive implementation
class OneDriveProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    let url = 'https://graph.microsoft.com/v1.0/me/drive';
    
    if (folderId) {
      url = `${url}/items/${folderId}/children`;
    } else {
      url = `${url}/root/children`;
    }

    // Add sorting and pagination
    url += `?$top=${limit}&$orderby=${sortBy} ${sortDirection}`;
    if (page > 1) {
      url += `&$skip=${(page - 1) * limit}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.provider.access_token}` },
    });

    if (!response.ok) {
      console.error('Error fetching OneDrive files:', response.status);
      throw new Error('Failed to fetch files from OneDrive');
    }

    const data = await response.json();
    
    return data.value.map((item: any) => ({
      id: item.id,
      name: item.name,
      isFolder: item.folder !== undefined,
      mimeType: item.file ? item.file.mimeType : null,
      size: item.size || 0,
      modifiedTime: item.lastModifiedDateTime,
      path: item.parentReference ? `${item.parentReference.path}/${item.name}` : `/${item.name}`,
    }));
  }
}

// Box implementation
class BoxProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    const rootFolderId = folderId || '0'; // Box uses '0' as the root folder ID
    
    let url = `https://api.box.com/2.0/folders/${rootFolderId}/items`;
    url += `?limit=${limit}&offset=${(page - 1) * limit}`;
    
    if (sortBy && sortDirection) {
      // Box API uses 'direction' instead of 'order' for sort direction
      url += `&sort=${sortBy}&direction=${sortDirection}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.provider.access_token}` },
    });

    if (!response.ok) {
      console.error('Error fetching Box files:', response.status);
      throw new Error('Failed to fetch files from Box');
    }

    const data = await response.json();
    
    return data.entries.map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      isFolder: entry.type === 'folder',
      mimeType: entry.type === 'file' ? entry.file_type : null,
      size: entry.size || 0,
      modifiedTime: entry.modified_at,
      path: `/${entry.name}`,
    }));
  }
}

// Amazon S3 implementation
class AmazonS3Provider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    // For S3, the folder concept is based on prefixes
    const prefix = folderId ? `${folderId}/` : '';
    const delimiter = '/';
    
    // Constructing the AWS signature v4 headers would be complex here
    // So we'd use the edge function's environment to store credentials and make the request
    const endpoint = `https://${this.provider.refresh_token}.s3.${this.provider.provider_user_email}.amazonaws.com`;
    
    const params = new URLSearchParams({
      'list-type': '2',
      'prefix': prefix,
      'delimiter': delimiter,
      'max-keys': limit.toString()
    });
    
    if (page > 1) {
      // S3 uses continuation-token for pagination
      params.append('continuation-token', btoa(`${(page - 1) * limit}`));
    }
    
    try {
      // In a real implementation, we'd use the AWS SDK or a proper signature generation
      // This is a simplified example assuming we have some authentication mechanism
      const url = `${endpoint}?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `AWS4-HMAC-SHA256 Credential=${this.provider.access_token}` // Simplified
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch S3 files: ${response.statusText}`);
      }
      
      const xmlData = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, "application/xml");
      
      const objects = Array.from(xmlDoc.getElementsByTagName('Contents'));
      const folders = Array.from(xmlDoc.getElementsByTagName('CommonPrefixes'));
      
      const files = objects.map(obj => {
        const key = obj.querySelector('Key')?.textContent || '';
        const filename = key.split('/').pop() || key;
        
        return {
          id: key,
          name: filename,
          isFolder: false,
          mimeType: 'application/octet-stream', // S3 doesn't provide mimetype in listing
          size: parseInt(obj.querySelector('Size')?.textContent || '0'),
          modifiedTime: obj.querySelector('LastModified')?.textContent || '',
          path: `/${key}`
        };
      });
      
      const folderItems = folders.map(folder => {
        const prefix = folder.querySelector('Prefix')?.textContent || '';
        const name = prefix.split('/').filter(Boolean).pop() || prefix;
        
        return {
          id: prefix,
          name: name,
          isFolder: true,
          mimeType: null,
          size: 0,
          modifiedTime: new Date().toISOString(), // S3 doesn't provide folder modified time
          path: `/${prefix}`
        };
      });
      
      return [...files, ...folderItems];
    } catch (error) {
      console.error('Error in S3 list files:', error);
      return []; // Return empty array on error
    }
  }
}

// MEGA implementation 
class MegaProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    // MEGA doesn't have a public API, so we would need to use a third-party library
    // This is a placeholder implementation
    console.log("MEGA API integration would require a third-party library");
    
    // Return a mock response for now
    return [
      {
        id: "mock-id-1",
        name: "Sample MEGA file",
        isFolder: false,
        mimeType: "application/pdf",
        size: 1024000,
        modifiedTime: new Date().toISOString(),
        path: "/Sample MEGA file"
      }
    ];
  }
}

// pCloud implementation
class PCloudProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    const folderId_param = folderId || 0;
    
    let url = 'https://api.pcloud.com/listfolder';
    const params = new URLSearchParams({
      folderid: folderId_param.toString(),
      limit: limit.toString(),
      offset: ((page - 1) * limit).toString()
    });
    
    // Add sorting parameters
    if (sortBy === 'name') {
      params.append('sort', 'name');
      params.append('asc', sortDirection === 'asc' ? '1' : '0');
    } else if (sortBy === 'date') {
      params.append('sort', 'modified');
      params.append('asc', sortDirection === 'asc' ? '1' : '0');
    } else if (sortBy === 'size') {
      params.append('sort', 'size');
      params.append('asc', sortDirection === 'asc' ? '1' : '0');
    }
    
    url = `${url}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.provider.access_token}`,
      },
    });

    if (!response.ok) {
      console.error('Error fetching pCloud files:', response.status);
      throw new Error('Failed to fetch files from pCloud');
    }

    const data = await response.json();
    
    if (data.result !== 0) {
      throw new Error(`pCloud API error: ${data.error}`);
    }
    
    const metadata = data.metadata;
    const contents = metadata.contents || [];
    
    return contents.map((item: any) => ({
      id: item.fileid || item.folderid,
      name: item.name,
      isFolder: item.isfolder,
      mimeType: item.contenttype || null,
      size: item.size || 0,
      modifiedTime: new Date(item.modified * 1000).toISOString(),
      path: item.path,
    }));
  }
}

// Yandex.Disk implementation
class YandexDiskProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    const path = folderId || '/';
    
    let url = 'https://cloud-api.yandex.net/v1/disk/resources';
    const params = new URLSearchParams({
      path,
      limit: limit.toString(),
      offset: ((page - 1) * limit).toString()
    });
    
    // Add sorting parameters
    if (sortBy === 'name') {
      params.append('sort', 'name');
    } else if (sortBy === 'date') {
      params.append('sort', 'modified');
    } else if (sortBy === 'size') {
      params.append('sort', 'size');
    }
    
    if (sortDirection === 'desc') {
      params.append('reverse', 'true');
    }
    
    url = `${url}?${params.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `OAuth ${this.provider.access_token}`,
      },
    });

    if (!response.ok) {
      console.error('Error fetching Yandex.Disk files:', response.status);
      throw new Error('Failed to fetch files from Yandex.Disk');
    }

    const data = await response.json();
    const items = data._embedded?.items || [];
    
    return items.map((item: any) => ({
      id: item.resource_id,
      name: item.name,
      isFolder: item.type === 'dir',
      mimeType: item.mime_type || null,
      size: item.size || 0,
      modifiedTime: item.modified,
      path: item.path,
    }));
  }
}

// Backblaze B2 implementation
class BackblazeProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    try {
      // First, authenticate to get API URL and authorization token
      const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        headers: {
          Authorization: `Basic ${btoa(`${this.provider.refresh_token}:${this.provider.access_token}`)}`,
        },
      });
      
      if (!authResponse.ok) {
        throw new Error(`B2 authentication failed: ${authResponse.statusText}`);
      }
      
      const authData = await authResponse.json();
      const { apiUrl, authorizationToken, allowed: { bucketName } } = authData;
      
      // List bucket files
      // In B2, folders are not real objects but are inferred from file paths
      const prefix = folderId ? `${folderId}/` : '';
      const delimiter = '/';
      
      const listFilesUrl = `${apiUrl}/b2api/v2/b2_list_file_names`;
      const listFilesBody = {
        bucketId: bucketName,
        prefix,
        delimiter,
        maxFileCount: limit,
        startFileName: page > 1 ? `${prefix}${(page - 1) * limit}` : undefined
      };
      
      const listFilesResponse = await fetch(listFilesUrl, {
        method: 'POST',
        headers: {
          Authorization: authorizationToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(listFilesBody)
      });
      
      if (!listFilesResponse.ok) {
        throw new Error(`B2 list files failed: ${listFilesResponse.statusText}`);
      }
      
      const listFilesData = await listFilesResponse.json();
      const { files, folders } = listFilesData;
      
      // Convert files to our format
      const fileItems = (files || []).map((file: any) => ({
        id: file.fileId,
        name: file.fileName.split('/').pop(),
        isFolder: false,
        mimeType: file.contentType || 'application/octet-stream',
        size: file.contentLength || 0,
        modifiedTime: new Date(file.uploadTimestamp).toISOString(),
        path: `/${file.fileName}`
      }));
      
      // Convert folders to our format
      const folderItems = (folders || []).map((folder: string) => {
        const folderName = folder.split('/').filter(Boolean).pop() || folder;
        return {
          id: folder,
          name: folderName,
          isFolder: true,
          mimeType: null,
          size: 0,
          modifiedTime: new Date().toISOString(),
          path: `/${folder}`
        };
      });
      
      return [...fileItems, ...folderItems];
    } catch (error) {
      console.error('Error in Backblaze B2 list files:', error);
      return []; // Return empty array on error
    }
  }
}

// Icedrive implementation
class IcedriveProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    try {
      // Icedrive API endpoints
      const endpoint = 'https://api.icedrive.io/v2';
      const folderEndpoint = `${endpoint}/folders`;
      
      // Get folder contents - folderId 0 is root in Icedrive
      const folderId_param = folderId || '0';
      
      const response = await fetch(`${folderEndpoint}/${folderId_param}/content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.provider.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          perpage: limit,
          page,
          sort_field: sortBy === 'name' ? 'name' : sortBy === 'date' ? 'mtime' : 'size',
          sort_direction: sortDirection.toUpperCase()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Icedrive API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(`Icedrive error: ${data.message}`);
      }
      
      // Process folders
      const folders = (data.data.folders || []).map((folder: any) => ({
        id: folder.id.toString(),
        name: folder.name,
        isFolder: true,
        mimeType: null,
        size: 0,
        modifiedTime: new Date(folder.mtime * 1000).toISOString(),
        path: folder.path || `/${folder.name}`
      }));
      
      // Process files
      const files = (data.data.files || []).map((file: any) => ({
        id: file.id.toString(),
        name: file.name,
        isFolder: false,
        mimeType: file.mime || 'application/octet-stream',
        size: parseInt(file.size) || 0,
        modifiedTime: new Date(file.mtime * 1000).toISOString(),
        path: file.path || `/${file.name}`
      }));
      
      return [...folders, ...files];
    } catch (error) {
      console.error('Error in Icedrive list files:', error);
      return []; // Return empty array on error
    }
  }
}

// Sync.com implementation
class SyncComProvider extends StorageProvider {
  async listFiles(
    folderId: string | null,
    page = 1,
    limit = 100,
    sortBy = 'name',
    sortDirection = 'asc'
  ) {
    try {
      // Sync.com API endpoint for listing files
      const apiUrl = 'https://api.sync.com/v1';
      
      // Default to root if no folderId provided
      const path = folderId || '/';
      
      // Build headers, including team ID if available
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.provider.access_token}`,
        'Content-Type': 'application/json'
      };
      
      if (this.provider.refresh_token) { // Using refresh_token field to store team ID
        headers['X-Team-ID'] = this.provider.refresh_token;
      }
      
      // Make the API request to list files
      const response = await fetch(`${apiUrl}/files?path=${encodeURIComponent(path)}&limit=${limit}&offset=${(page - 1) * limit}`, {
        method: 'GET',
        headers
      });
      
      if (!response.ok) {
        throw new Error(`Sync.com API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Process and normalize the response
      return data.files.map((item: any) => ({
        id: item.id,
        name: item.name,
        isFolder: item.type === 'folder',
        mimeType: item.mime_type || null,
        size: parseInt(item.size) || 0,
        modifiedTime: item.modified_at,
        path: item.path
      }));
    } catch (error) {
      console.error('Error in Sync.com list files:', error);
      return []; // Return empty array on error
    }
  }
}

// Factory to create the appropriate provider instance
function createProviderInstance(provider: any): StorageProvider {
  switch (provider.provider_name) {
    case 'google-drive':
      return new GoogleDriveProvider(provider);
    case 'dropbox':
      return new DropboxProvider(provider);
    case 'onedrive':
      return new OneDriveProvider(provider);
    case 'box':
      return new BoxProvider(provider);
    case 'amazon-s3':
      return new AmazonS3Provider(provider);
    case 'mega':
      return new MegaProvider(provider);
    case 'pcloud':
      return new PCloudProvider(provider);
    case 'yandex-disk':
      return new YandexDiskProvider(provider);
    case 'backblaze':
      return new BackblazeProvider(provider);
    case 'icedrive':
      return new IcedriveProvider(provider);
    case 'sync':
      return new SyncComProvider(provider);
    default:
      throw new Error(`Unsupported provider: ${provider.provider_name}`);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const { providerId, folderId, session, page = 1, limit = 100, sortBy, sortDirection } = await req.json();

      // Create Supabase client with user's session
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${session}`,
          },
        },
      });

      // Get provider info
      const { data: provider, error: providerError } = await supabase
        .from('storage_providers')
        .select('*')
        .eq('id', providerId)
        .single();

      if (providerError) {
        console.error('Error fetching provider:', providerError);
        throw new Error('Provider not found');
      }

      // Create the appropriate provider instance
      try {
        const providerInstance = createProviderInstance(provider);
        const files = await providerInstance.listFiles(folderId, page, limit, sortBy, sortDirection);
        
        // Insert or update file records in database
        const { data: userData } = await supabase.auth.getUser();
        
        if (!userData.user) {
          throw new Error('User not authenticated');
        }

        const dbPromises = files.map(async (file) => {
          const { data, error } = await supabase
            .from('files')
            .upsert({
              user_id: userData.user.id,
              filename: file.name,
              size: file.size || 0,
              mime_type: file.mimeType || null,
              provider_id: providerId,
              provider_file_id: file.id,
              parent_folder_id: folderId || null,
              is_folder: file.isFolder,
              path: file.path || `/${file.name}`,
              last_accessed_at: new Date().toISOString()
            }, {
              onConflict: 'provider_file_id',
              ignoreDuplicates: false
            })
            .select();

          if (error) {
            console.error('Error inserting/updating file record:', error);
          }

          return data ? data[0] : null;
        });

        const dbResults = await Promise.all(dbPromises);
        const validResults = dbResults.filter(Boolean);

        return new Response(
          JSON.stringify({ files: validResults }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } catch (error) {
        console.error('Error listing files:', error);
        return new Response(
          JSON.stringify({ error: error.message || 'Failed to list files' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          }
        );
      }
    }

    // If we get here, it's an unsupported method
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('Error in list-provider-files function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
