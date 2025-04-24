
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const PCLOUD_CLIENT_ID = Deno.env.get('PCLOUD_CLIENT_ID') || '';
const PCLOUD_CLIENT_SECRET = Deno.env.get('PCLOUD_CLIENT_SECRET') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');

    if (!code) {
      // Generate OAuth URL for initial authorization
      const authUrl = `https://my.pcloud.com/oauth2/authorize?client_id=${PCLOUD_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(`${url.origin}/pcloud-callback`)}`;
      
      return new Response(
        JSON.stringify({ url: authUrl }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.pcloud.com/oauth2_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: PCLOUD_CLIENT_ID,
        client_secret: PCLOUD_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get user info
    const userInfoResponse = await fetch('https://api.pcloud.com/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const userInfo = await userInfoResponse.json();

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
        provider_name: 'pcloud',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        provider_user_email: userInfo.email,
        total_space: userInfo.quota,
        used_space: userInfo.usedquota,
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
          name: 'pCloud',
          email: userInfo.email,
          totalSpace: userInfo.quota,
          usedSpace: userInfo.usedquota
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in pCloud auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
