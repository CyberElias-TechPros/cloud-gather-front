
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
    
    if (!credentials?.keyId || !credentials?.applicationKey || !credentials?.bucket) {
      throw new Error('Key ID, Application Key, and Bucket name are required');
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No session found');
    }

    // Authenticate with Backblaze B2
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: {
        'Authorization': `Basic ${btoa(`${credentials.keyId}:${credentials.applicationKey}`)}`,
      },
    });

    if (!authResponse.ok) {
      throw new Error('Invalid credentials');
    }

    const authData = await authResponse.json();

    // Save provider info to database
    const { data: providerData, error: providerError } = await supabase
      .from('storage_providers')
      .insert({
        provider_name: 'backblaze',
        access_token: credentials.applicationKey,
        refresh_token: credentials.keyId,
        provider_user_email: authData.accountId,
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
    console.error('Error in Backblaze auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
