
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { credentials } = await req.json();
    
    if (!credentials?.apiKey) {
      throw new Error('API key is required');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No session found');
    }

    // Validate the API key by making a test request to Sync.com
    const response = await fetch('https://api.sync.com/v1/user', {
      headers: {
        'Authorization': `Bearer ${credentials.apiKey}`,
        'X-Team-ID': credentials.teamId || '',
      },
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    const userData = await response.json();

    // Save provider info to database
    const { data: providerData, error: providerError } = await supabase
      .from('storage_providers')
      .insert({
        provider_name: 'sync',
        access_token: credentials.apiKey,
        provider_user_email: userData.email,
        status: 'connected',
        user_id: session.user.id,
      })
      .select()
      .single();

    if (providerError) {
      throw providerError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in Sync.com auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
