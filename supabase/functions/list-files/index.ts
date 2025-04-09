
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const { providerId, folderId, session } = await req.json();

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

      // Based on provider type, list files using the appropriate API
      let files = [];
      
      if (provider.provider_name === 'google-drive') {
        files = await listGoogleDriveFiles(provider, folderId);
      } else if (provider.provider_name === 'dropbox') {
        files = await listDropboxFiles(provider, folderId);
      } else if (provider.provider_name === 'onedrive') {
        files = await listOneDriveFiles(provider, folderId);
      } else {
        throw new Error(`Unsupported provider: ${provider.provider_name}`);
      }

      // Insert or update file records in database
      const dbPromises = files.map(async (file) => {
        const { data, error } = await supabase
          .from('files')
          .upsert({
            user_id: provider.user_id,
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
    }

    // If we get here, it's an unsupported method
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('Error in list-files function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function listGoogleDriveFiles(provider: any, folderId: string | null) {
  let url = 'https://www.googleapis.com/drive/v3/files';
  const params = new URLSearchParams({
    fields: 'files(id,name,mimeType,size,modifiedTime,parents)',
    pageSize: '100',
    orderBy: 'name'
  });

  if (folderId) {
    params.append('q', `'${folderId}' in parents`);
  } else {
    params.append('q', `'root' in parents or parents = null`);
  }

  url = `${url}?${params.toString()}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${provider.access_token}` },
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

async function listDropboxFiles(provider: any, folderId: string | null) {
  const path = folderId || '';
  
  const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: path === '' ? '' : `/${path}`,
      recursive: false,
      include_media_info: true,
      include_deleted: false
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

async function listOneDriveFiles(provider: any, folderId: string | null) {
  let url = 'https://graph.microsoft.com/v1.0/me/drive';
  
  if (folderId) {
    url = `${url}/items/${folderId}/children`;
  } else {
    url = `${url}/root/children`;
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${provider.access_token}` },
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
