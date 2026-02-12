// @ts-ignore
/// <reference lib="deno.ns" />

// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const functionName = "delete-user";

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${functionName}] Unauthorized: No auth header`);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the caller is an admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller }, error: callerError } = await supabaseAdmin.auth.getUser(token);
    
    if (callerError || !caller) {
      console.error(`[${functionName}] Invalid session:`, callerError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }

    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', caller.id)
      .single();

    if (profileFetchError || profile?.user_type !== 'admin') {
      console.error(`[${functionName}] Forbidden: User is not an admin`, profileFetchError);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403, headers: corsHeaders });
    }

    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400, headers: corsHeaders });
    }

    console.log(`[${functionName}] Deleting user: ${userId}`);

    // The database migrations handle cascading SET NULL, so we can directly delete the user.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error(`[${functionName}] Error deleting user from auth:`, deleteError);
      throw new Error(`Database error deleting user: ${deleteError.message}`);
    }

    console.log(`[${functionName}] Successfully deleted user: ${userId}`);

    return new Response(JSON.stringify({ message: 'User deleted successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${functionName}] Unexpected error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});