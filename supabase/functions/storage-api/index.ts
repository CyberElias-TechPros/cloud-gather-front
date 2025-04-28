
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

/**
 * This function implements a RESTful API for accessing the Cloud Edifix storage service.
 * It provides endpoints for:
 * - Listing files
 * - Uploading files
 * - Downloading files
 * - Getting file metadata
 * - Deleting files
 * - Sharing files
 */
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // First, validate the API key
    const { data: apiKeyData, error: apiKeyError } = await supabase
      .from('api_keys')
      .select('user_id, permissions, status')
      .eq('key', apiKey)
      .eq('status', 'active')
      .single();

    if (apiKeyError || !apiKeyData) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired API key' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use the user_id from the API key for subsequent requests
    const userId = apiKeyData.user_id;
    const permissions = apiKeyData.permissions;

    // Update the last used timestamp for this API key
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key', apiKey);

    // Route handling based on path and method
    if (path.startsWith('/api/v1/files')) {
      // List files
      if (req.method === 'GET' && path === '/api/v1/files') {
        // Check permissions
        if (!permissions.includes('read')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const parentFolderId = url.searchParams.get('folder') || null;
        const sortBy = url.searchParams.get('sort') || 'date';
        const sortDirection = url.searchParams.get('direction') || 'desc';

        let query = supabase
          .from('files')
          .select('*')
          .eq('user_id', userId);

        if (parentFolderId) {
          query = query.eq('parent_folder_id', parentFolderId);
        } else {
          query = query.is('parent_folder_id', null);
        }

        // Add sorting
        if (sortBy === 'name') {
          query = query.order('filename', { ascending: sortDirection === 'asc' });
        } else if (sortBy === 'date') {
          query = query.order('updated_at', { ascending: sortDirection === 'asc' });
        } else if (sortBy === 'size') {
          query = query.order('size', { ascending: sortDirection === 'asc' });
        }

        const { data: files, error: filesError } = await query;

        if (filesError) {
          return new Response(
            JSON.stringify({ error: filesError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ files }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Get file metadata
      if (req.method === 'GET' && path.match(/^\/api\/v1\/files\/[^\/]+$/)) {
        // Check permissions
        if (!permissions.includes('read')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const fileId = path.split('/').pop();
        
        const { data: file, error: fileError } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .eq('user_id', userId)
          .single();

        if (fileError) {
          return new Response(
            JSON.stringify({ error: fileError.message }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Update last_accessed_at for the file
        await supabase
          .from('files')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', fileId)
          .eq('user_id', userId);

        return new Response(
          JSON.stringify({ file }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Download file
      if (req.method === 'GET' && path.match(/^\/api\/v1\/files\/[^\/]+\/download$/)) {
        // Check permissions
        if (!permissions.includes('read')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const fileId = path.split('/').slice(-2)[0];
        
        const { data: file, error: fileError } = await supabase
          .from('files')
          .select('provider_id, provider_file_id, filename, mime_type')
          .eq('id', fileId)
          .eq('user_id', userId)
          .single();

        if (fileError) {
          return new Response(
            JSON.stringify({ error: fileError.message }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Update last_accessed_at for the file
        await supabase
          .from('files')
          .update({ last_accessed_at: new Date().toISOString() })
          .eq('id', fileId)
          .eq('user_id', userId);

        if (!file.provider_id) {
          // File is stored in Supabase Storage
          const { data: storageData, error: storageError } = await supabase
            .storage
            .from('user_uploads')
            .download(file.provider_file_id);

          if (storageError) {
            return new Response(
              JSON.stringify({ error: storageError.message }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(storageData, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': file.mime_type || 'application/octet-stream',
              'Content-Disposition': `attachment; filename=${encodeURIComponent(file.filename)}`,
            },
          });
        } else {
          // File is stored in an external provider
          // For this API, we should return a direct download URL or redirect
          return new Response(
            JSON.stringify({ 
              error: 'External provider downloads not implemented directly in API',
              message: 'Use the web interface to download files from external providers'
            }),
            {
              status: 501,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      // Create folder
      if (req.method === 'POST' && path === '/api/v1/files/folder') {
        // Check permissions
        if (!permissions.includes('write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const { folderName, parentFolderId } = await req.json();
        
        if (!folderName) {
          return new Response(
            JSON.stringify({ error: 'Folder name is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Get path for the new folder
        let path = `/${folderName}`;
        
        if (parentFolderId) {
          const { data: parentFolder, error: parentError } = await supabase
            .from('files')
            .select('path')
            .eq('id', parentFolderId)
            .eq('user_id', userId)
            .eq('is_folder', true)
            .single();

          if (parentError) {
            return new Response(
              JSON.stringify({ error: 'Parent folder not found' }),
              {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          path = `${parentFolder.path}/${folderName}`;
        }

        const { data: folder, error: folderError } = await supabase
          .from('files')
          .insert({
            filename: folderName,
            path,
            size: 0,
            is_folder: true,
            parent_folder_id: parentFolderId,
            user_id: userId
          })
          .select()
          .single();

        if (folderError) {
          return new Response(
            JSON.stringify({ error: folderError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ folder }),
          {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Upload file
      if (req.method === 'POST' && path === '/api/v1/files/upload') {
        // Check permissions
        if (!permissions.includes('write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const formData = await req.formData();
        const file = formData.get('file');
        const parentFolderId = formData.get('parentFolderId')?.toString() || null;
        
        if (!file || !(file instanceof File)) {
          return new Response(
            JSON.stringify({ error: 'File is required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Get path for the new file
        let filePath = `/${file.name}`;
        
        if (parentFolderId) {
          const { data: parentFolder, error: parentError } = await supabase
            .from('files')
            .select('path')
            .eq('id', parentFolderId)
            .eq('user_id', userId)
            .eq('is_folder', true)
            .single();

          if (parentError) {
            return new Response(
              JSON.stringify({ error: 'Parent folder not found' }),
              {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          filePath = `${parentFolder.path}/${file.name}`;
        }

        // Upload to Supabase Storage
        const storageFilePath = `${userId}/${Date.now()}_${file.name}`;
        const { data: storageData, error: storageError } = await supabase
          .storage
          .from('user_uploads')
          .upload(storageFilePath, file);

        if (storageError) {
          return new Response(
            JSON.stringify({ error: storageError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // Create file record in database
        const { data: fileRecord, error: fileError } = await supabase
          .from('files')
          .insert({
            filename: file.name,
            path: filePath,
            size: file.size,
            mime_type: file.type,
            provider_file_id: storageFilePath,
            parent_folder_id: parentFolderId,
            user_id: userId
          })
          .select()
          .single();

        if (fileError) {
          return new Response(
            JSON.stringify({ error: fileError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ file: fileRecord }),
          {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Delete file
      if (req.method === 'DELETE' && path.match(/^\/api\/v1\/files\/[^\/]+$/)) {
        // Check permissions
        if (!permissions.includes('delete')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const fileId = path.split('/').pop();
        
        const { data: file, error: fileError } = await supabase
          .from('files')
          .select('provider_file_id, is_folder')
          .eq('id', fileId)
          .eq('user_id', userId)
          .single();

        if (fileError) {
          return new Response(
            JSON.stringify({ error: fileError.message }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        // If it's a folder, we need to recursively delete all files in it
        if (file.is_folder) {
          const { data: children, error: childrenError } = await supabase
            .from('files')
            .select('id')
            .eq('parent_folder_id', fileId);

          if (childrenError) {
            return new Response(
              JSON.stringify({ error: childrenError.message }),
              {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              }
            );
          }

          // This would be better implemented as a recursive function in a real application
          for (const child of children || []) {
            const { error: deleteChildError } = await supabase
              .from('files')
              .delete()
              .eq('id', child.id)
              .eq('user_id', userId);

            if (deleteChildError) {
              console.error(`Error deleting child file ${child.id}:`, deleteChildError);
            }
          }
        } else if (file.provider_file_id && !file.provider_file_id.includes('/')) {
          // Delete from Supabase storage if it's a file stored there
          const { error: storageError } = await supabase
            .storage
            .from('user_uploads')
            .remove([file.provider_file_id]);

          if (storageError) {
            console.error('Error deleting file from storage:', storageError);
            // Continue to delete the database record even if storage deletion fails
          }
        }

        // Delete the file record
        const { error: deleteError } = await supabase
          .from('files')
          .delete()
          .eq('id', fileId)
          .eq('user_id', userId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      // Share file
      if (req.method === 'POST' && path.match(/^\/api\/v1\/files\/[^\/]+\/share$/)) {
        // Check permissions
        if (!permissions.includes('write')) {
          return new Response(
            JSON.stringify({ error: 'Insufficient permissions' }),
            {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        const fileId = path.split('/').slice(-2)[0];
        const { email, permissionLevel, expiresAt } = await req.json();
        
        if (!email || !permissionLevel) {
          return new Response(
            JSON.stringify({ error: 'Email and permission level are required' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        // Check if file exists and belongs to user
        const { data: file, error: fileError } = await supabase
          .from('files')
          .select('*')
          .eq('id', fileId)
          .eq('user_id', userId)
          .single();
          
        if (fileError) {
          return new Response(
            JSON.stringify({ error: 'File not found' }),
            {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        // Create share record
        const { data: share, error: shareError } = await supabase
          .from('file_shares')
          .insert({
            file_id: fileId,
            owner_id: userId,
            shared_with_email: email,
            permission_level: permissionLevel,
            expires_at: expiresAt
          })
          .select()
          .single();
          
        if (shareError) {
          return new Response(
            JSON.stringify({ error: shareError.message }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
        
        // Update file to mark it as shared
        await supabase
          .from('files')
          .update({ is_shared: true })
          .eq('id', fileId)
          .eq('user_id', userId);
        
        return new Response(
          JSON.stringify({ share }),
          {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Default: Method not allowed
    return new Response(
      JSON.stringify({ error: 'Method not allowed or endpoint not found' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in storage API function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
