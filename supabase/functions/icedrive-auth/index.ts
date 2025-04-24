
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
    
    if (!credentials?.apiToken) {
      throw new Error('API token is required');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No session found');
    }

    // Validate the API token by making a test request to Icedrive
    const response = await fetch('https://api.icedrive.net/v2/account/info', {
      headers: {
        'Authorization': `Bearer ${credentials.apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error('Invalid API token');
    }

    const accountInfo = await response.json();

    // Save provider info to database
    const { data: providerData, error: providerError } = await supabase
      .from('storage_providers')
      .insert({
        provider_name: 'icedrive',
        access_token: credentials.apiToken,
        provider_user_email: accountInfo.email,
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
    console.error('Error in Icedrive auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
