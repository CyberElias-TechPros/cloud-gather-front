
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REDIRECT_URI = Deno.env.get('REDIRECT_URI') || 'http://localhost:3000/providers';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    // Step 1: Generate authorization URL for Google OAuth
    if (req.method === 'POST' && !path?.includes('callback')) {
      const { session } = await req.json();
      
      // We need to save the session token to use it in the callback
      // For a real application, use a proper session store
      
      // Generate OAuth URL
      const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email');
      const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=code&access_type=offline&prompt=consent`;
      
      return new Response(
        JSON.stringify({ url: authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Step 2: Handle callback from Google with auth code
    if (req.method === 'GET' && path?.includes('callback')) {
      const code = url.searchParams.get('code');
      
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'No authorization code provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Exchange the code for access and refresh tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Error exchanging code for token:', errorData);
        throw new Error('Failed to exchange authorization code for tokens');
      }
      
      const tokenData = await tokenResponse.json();
      
      // Get user info from Google
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
      
      if (!userInfoResponse.ok) {
        throw new Error('Failed to fetch user info');
      }
      
      const userInfo = await userInfoResponse.json();
      
      // Get Google Drive storage quota
      const driveResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
      
      if (!driveResponse.ok) {
        throw new Error('Failed to fetch drive info');
      }
      
      const driveInfo = await driveResponse.json();
      const storageQuota = driveInfo.storageQuota || {};
      
      // Get the session from the query param
      const sessionToken = url.searchParams.get('session');
      
      if (!sessionToken) {
        return new Response(
          JSON.stringify({ error: 'No session token provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Create Supabase client with the user's session
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      });
      
      // Get the user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Failed to get user information');
      }
      
      // Save the provider information to the database
      const { data, error } = await supabase.from('storage_providers').insert({
        user_id: user.id,
        provider_name: 'google-drive',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        total_space: parseInt(storageQuota.limit || '0'),
        used_space: parseInt(storageQuota.usage || '0'),
        provider_user_email: userInfo.email,
        status: 'connected',
        priority: 1, // Default priority for new provider
      }).select();
      
      if (error) {
        console.error('Error saving provider information:', error);
        throw error;
      }
      
      // Return an HTML page that will close the popup and call the window.opener function
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <script>
            window.onload = function() {
              if (window.opener) {
                window.opener.handleOAuthCallback('${code}');
                window.close();
              } else {
                document.getElementById('message').innerText = 'Authentication successful! You can close this window.';
              }
            }
          </script>
        </head>
        <body>
          <div id="message">Completing authentication...</div>
        </body>
        </html>
      `, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }
    
    // If we get here, it's an unsupported request
    return new Response(
      JSON.stringify({ error: 'Unsupported request' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in Google Drive auth function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
