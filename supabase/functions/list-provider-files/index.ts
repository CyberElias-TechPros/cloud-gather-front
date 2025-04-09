
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
    // This is a placeholder for Amazon S3 implementation
    // In a real implementation, this would use the AWS SDK to list objects in an S3 bucket
    return [];
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
