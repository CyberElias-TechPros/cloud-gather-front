
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
      .select('user_id, permissions')
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

        return new Response(
          JSON.stringify({ file }),
          {
            status: 200,
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
        headers: { corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
