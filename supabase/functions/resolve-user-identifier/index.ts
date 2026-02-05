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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { identifier } = await req.json();
    if (!identifier) {
      return new Response(JSON.stringify({ error: 'Identifier is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (isValidEmail(identifier)) {
      return new Response(JSON.stringify({ email: identifier }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .or(`first_name.ilike.%${identifier}%,last_name.ilike.%${identifier}%`);
    if (profilesError) throw new Error(`Failed to resolve name: ${profilesError.message}`);

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found with that name.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let targetProfile = null;
    if (profiles.length > 1) {
      targetProfile = profiles.find(p => 
        p.first_name?.toLowerCase() === identifier.toLowerCase() || 
        p.last_name?.toLowerCase() === identifier.toLowerCase() ||
        `${p.first_name} ${p.last_name}`.toLowerCase() === identifier.toLowerCase()
      );
      if (!targetProfile) {
        return new Response(JSON.stringify({ error: 'Multiple users found with a similar name. Please use the exact name or email address.' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      targetProfile = profiles[0];
    }

    const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(targetProfile.id);
    if (authUserError) throw new Error(`Failed to retrieve user email: ${authUserError.message}`);
    if (!authUser.user?.email) {
      return new Response(JSON.stringify({ error: 'Could not resolve identifier to a user email.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ email: authUser.user.email }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});