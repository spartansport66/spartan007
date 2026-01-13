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

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password, first_name, last_name, user_type } = await req.json();

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Always set email_confirm to false and email_confirmed_at to now()
    // This ensures all users created via this function are immediately considered confirmed.
    const emailConfirm = false;
    const emailConfirmedAt = new Date().toISOString();

    // Create the user using the admin client
    const { data: userResponse, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: emailConfirm,
      email_confirmed_at: emailConfirmedAt, // Explicitly set email_confirmed_at for all users
      user_metadata: {
        first_name,
        last_name,
        user_type, // Pass user_type to the handle_new_user trigger
      },
    });

    if (userError) {
      console.error('Error creating user:', userError.message);
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: 'User created successfully', user: userResponse.user }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});