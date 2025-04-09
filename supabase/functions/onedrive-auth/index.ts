
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID') || '';
const CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET') || '';
const REDIRECT_URI = Deno.env.get('MICROSOFT_REDIRECT_URI') || '';
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
      const scopes = [
        'files.read',
        'files.read.all',
        'user.read',
        'offline_access',
      ];

      const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      authUrl.searchParams.append('client_id', CLIENT_ID);
      authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', scopes.join(' '));

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
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Error exchanging code for tokens:', errorData);
        throw new Error('Failed to exchange code for tokens');
      }

      const tokenData = await tokenResponse.json();

      // Get user info
      const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to fetch user info');
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await userInfoResponse.json();

      // Get drive info
      const driveResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
      });

      if (!driveResponse.ok) {
        console.error('Failed to fetch drive info');
        throw new Error('Failed to fetch drive info');
      }

      const driveInfo = await driveResponse.json();
      const totalSpace = driveInfo.quota?.total || null;
      const usedSpace = driveInfo.quota?.used || 0;

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
          provider_name: 'onedrive',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          total_space: totalSpace,
          used_space: usedSpace,
          status: 'connected',
          provider_user_email: userInfo.userPrincipalName || userInfo.mail,
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
            name: 'OneDrive',
            email: userInfo.userPrincipalName || userInfo.mail,
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
    console.error('Error in OneDrive auth function:', error);
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
