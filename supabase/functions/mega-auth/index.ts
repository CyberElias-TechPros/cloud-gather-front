
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const MEGA_CLIENT_ID = Deno.env.get('MEGA_CLIENT_ID') || '';
const MEGA_CLIENT_SECRET = Deno.env.get('MEGA_CLIENT_SECRET') || '';
const MEGA_REDIRECT_URI = Deno.env.get('MEGA_REDIRECT_URI') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      // Initial auth URL generation
      // Note: MEGA uses a different OAuth flow than other providers
      // This is a simplified version and would need to be updated with actual MEGA API endpoints
      const authUrl = new URL('https://mega.nz/oauth/auth');
      authUrl.searchParams.append('client_id', MEGA_CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', MEGA_REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', 'files');

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
      // Again, this is simplified and would need to use actual MEGA API endpoints
      const tokenResponse = await fetch('https://mega.nz/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: MEGA_CLIENT_ID,
          client_secret: MEGA_CLIENT_SECRET,
          redirect_uri: MEGA_REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Error exchanging code for tokens:', errorData);
        throw new Error('Failed to exchange code for tokens');
      }

      const tokenData = await tokenResponse.json();

      // Get user info
      const userInfoResponse = await fetch('https://mega.nz/api/user', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to fetch user info');
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userInfoResponse.json();

      // Get space usage
      const spaceUsageResponse = await fetch('https://mega.nz/api/quota', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!spaceUsageResponse.ok) {
        console.error('Failed to fetch space usage');
        throw new Error('Failed to fetch space usage');
      }

      const spaceUsage = await spaceUsageResponse.json();
      const totalSpace = spaceUsage.totalSpace || null;
      const usedSpace = spaceUsage.usedSpace || 0;

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
          provider_name: 'mega',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          total_space: totalSpace,
          used_space: usedSpace,
          status: 'connected',
          provider_user_email: userInfo.email,
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
            name: 'MEGA',
            email: userInfo.email,
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
    console.error('Error in MEGA auth function:', error);
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
