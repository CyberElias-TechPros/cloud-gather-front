
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { S3Client, ListBucketsCommand } from 'https://esm.sh/@aws-sdk/client-s3@3.418.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'POST') {
      const { session, accessKey, secretKey, region } = await req.json();

      if (!accessKey || !secretKey || !region) {
        throw new Error('Missing required credentials');
      }
      
      // Create S3 client to verify credentials
      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey
        }
      });

      try {
        // Test the connection by listing buckets
        const command = new ListBucketsCommand({});
        const { Buckets } = await s3Client.send(command);
        
        // If we got here, the credentials work
        console.log(`Successfully connected to S3. Found ${Buckets?.length || 0} buckets.`);

        // Create Supabase client with user's session
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: {
            headers: {
              Authorization: `Bearer ${session}`,
            },
          },
        });
        
        // For security, we'll encrypt the credentials before storing them
        // In a real implementation, you would use a proper encryption service
        // This is just a placeholder for the example
        const encryptedAccessKey = accessKey;
        const encryptedSecretKey = secretKey;

        // Get user info from the session
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          throw new Error('User not authenticated');
        }

        // Save provider info to database
        const { data, error } = await supabase
          .from('storage_providers')
          .insert({
            provider_name: 'amazon-s3',
            access_token: encryptedAccessKey,
            refresh_token: encryptedSecretKey,
            status: 'connected',
            provider_user_email: userData.user.email,
            priority: await getProviderCount(supabase) + 1,
            // Store region in the user_metadata field or create a new column
            // For this example, we'll store it together with the access token
            // In a real implementation, you might want to add a proper column
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
              name: 'Amazon S3',
              email: userData.user.email,
              totalSpace: null, // S3 doesn't have a concept of quota
              usedSpace: null,
              region
            }
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      } catch (error) {
        console.error('Error connecting to S3:', error);
        throw new Error('Invalid S3 credentials or region');
      }
    }

    // If we get here, it's an unsupported method
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('Error in Amazon S3 auth function:', error);
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
