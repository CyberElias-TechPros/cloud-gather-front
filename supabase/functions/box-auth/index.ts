
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = Deno.env.get('BOX_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('BOX_CLIENT_SECRET') || '';
const REDIRECT_URI = Deno.env.get('BOX_REDIRECT_URI') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      // Initial auth URL generation
      const authUrl = new URL('https://account.box.com/api/oauth2/authorize');
      authUrl.searchParams.append('client_id', CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', 'root_readwrite');

      return new Response(
        JSON.stringify({ url: authUrl.toString() }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    if (req.method === 'POST') {
      // Handle code exchange
      const { code, session } = await req.json();

      // Exchange code for tokens
      const tokenResponse = await fetch('https://api.box.com/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Error exchanging code for tokens:', errorData);
        throw new Error('Failed to exchange code for tokens');
      }

      const tokenData = await tokenResponse.json();

      // Get user info
      const userInfoResponse = await fetch('https://api.box.com/2.0/users/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to fetch user info');
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userInfoResponse.json();

      // Get space usage
      const spaceUsageResponse = await fetch('https://api.box.com/2.0/users/me?fields=space_used,space_amount', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!spaceUsageResponse.ok) {
        console.error('Failed to fetch space usage');
        throw new Error('Failed to fetch space usage');
      }

      const spaceUsage = await spaceUsageResponse.json();
      const totalSpace = spaceUsage.space_amount || null;
      const usedSpace = spaceUsage.space_used || 0;

      // Create Supabase client with user's session
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${session}`,
          },
        },
      });

      // Save provider info to database
      const { data, error } = await supabase
        .from('storage_providers')
        .insert({
          provider_name: 'box',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          total_space: totalSpace,
          used_space: usedSpace,
          status: 'connected',
          provider_user_email: userInfo.login,
          // Get current count of providers for priority
          priority: await getProviderCount(supabase) + 1,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving provider to database:', error);
        throw error;
      }

      return new Response(
        JSON.stringify({ 
          provider: {
            id: data.id,
            name: 'Box',
            email: userInfo.login,
            totalSpace,
            usedSpace
          }
        }),
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
    console.error('Error in Box auth function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function getProviderCount(supabase) {
  const { count, error } = await supabase
    .from('storage_providers')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Error counting providers:', error);
    return 0;
  }

  return count || 0;
}
