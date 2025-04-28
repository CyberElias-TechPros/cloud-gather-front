
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { randomString } from 'https://deno.land/x/random_string@v1.0.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No session found');
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    const userId = session.user.id;

    // Check if the API key table exists, create if not
    const apiKeyTableExists = await checkApiKeyTable(supabase);
    if (!apiKeyTableExists) {
      await createApiKeyTable(supabase);
    }

    if (req.method === 'GET') {
      // List API keys
      const { data: keys, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Remove sensitive information before sending
      const safeKeys = keys.map(key => ({
        ...key,
        key: key.key.slice(0, 8) + '...' + key.key.slice(-4)
      }));
      
      return new Response(
        JSON.stringify({ keys: safeKeys }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    } 
    
    else if (req.method === 'POST') {
      const { name, permissions, expiresAt } = await req.json();
      
      if (!name) {
        throw new Error('API key name is required');
      }
      
      if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
        throw new Error('At least one permission is required');
      }
      
      // Generate a random API key with prefix
      const apiKey = `ku_${randomString({ length: 32 })}`;
      
      const { data, error } = await supabase
        .from('api_keys')
        .insert({
          name,
          key: apiKey,
          user_id: userId,
          permissions,
          expires_at: expiresAt,
          status: 'active'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ 
          apiKey: {
            ...data,
            key: apiKey // Return the full key only once
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 201
        }
      );
    } 
    
    else if (req.method === 'DELETE' && path) {
      const keyId = path;
      
      const { error } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' })
        .eq('id', keyId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }
    
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    );
    
  } catch (error) {
    console.error('API Key Management Error:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

async function checkApiKeyTable(supabase: any): Promise<boolean> {
  try {
    // Try to query the api_keys table
    const { error } = await supabase.from('api_keys').select('id').limit(1);
    return !error;
  } catch (error) {
    return false;
  }
}

async function createApiKeyTable(supabase: any): Promise<void> {
  // Create the api_keys table using raw SQL
  const { error } = await supabase.rpc('create_api_keys_table');
  if (error) throw error;
}
