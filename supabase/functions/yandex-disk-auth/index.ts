
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const YANDEX_CLIENT_ID = Deno.env.get('YANDEX_CLIENT_ID') || '';
const YANDEX_CLIENT_SECRET = Deno.env.get('YANDEX_CLIENT_SECRET') || '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
      const authUrl = `https://oauth.yandex.com/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}`;
      
      return new Response(
        JSON.stringify({ url: authUrl }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://oauth.yandex.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: YANDEX_CLIENT_ID,
        client_secret: YANDEX_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info and disk space
    const diskInfoResponse = await fetch('https://cloud-api.yandex.net/v1/disk/', {
      headers: {
        Authorization: `OAuth ${tokenData.access_token}`,
      },
    });

    const diskInfo = await diskInfoResponse.json();

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No session found');
    }

    // Save provider info to database
    const { data: providerData, error: providerError } = await supabase
      .from('storage_providers')
      .insert({
        provider_name: 'yandex-disk',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        provider_user_email: diskInfo.user.login,
        total_space: diskInfo.total_space,
        used_space: diskInfo.used_space,
        status: 'connected',
        user_id: session.user.id,
      })
      .select()
      .single();

    if (providerError) {
      throw providerError;
    }

    return new Response(
      JSON.stringify({ 
        provider: {
          id: providerData.id,
          name: 'Yandex Disk',
          email: diskInfo.user.login,
          totalSpace: diskInfo.total_space,
          usedSpace: diskInfo.used_space
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in Yandex Disk auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
