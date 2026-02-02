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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { identifier } = await req.json();

    if (!identifier) {
      console.log("[resolve-user-identifier] Identifier is required.");
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

    // Function to validate email format
    const isValidEmail = (email: string) => {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    let userEmail = null;

    if (isValidEmail(identifier)) {
      // If identifier is an email, use it directly
      userEmail = identifier;
      console.log(`[resolve-user-identifier] Identifier is an email: ${userEmail}`);
    } else {
      // Assume identifier is a name, try to resolve it to an email
      console.log(`[resolve-user-identifier] Identifier is a name: ${identifier}. Attempting to resolve.`);
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .or(`first_name.ilike.%${identifier}%,last_name.ilike.%${identifier}%`);

      if (profilesError) {
        console.error("[resolve-user-identifier] Error fetching profiles:", profilesError.message);
        throw new Error(`Failed to resolve name: ${profilesError.message}`);
      }

      if (!profiles || profiles.length === 0) {
        console.log(`[resolve-user-identifier] No user found with name: ${identifier}`);
        return new Response(JSON.stringify({ error: 'User not found with that name.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (profiles.length > 1) {
        // Check for exact match first to reduce ambiguity
        const exactMatch = profiles.find(p => 
          p.first_name?.toLowerCase() === identifier.toLowerCase() || 
          p.last_name?.toLowerCase() === identifier.toLowerCase() ||
          `${p.first_name} ${p.last_name}`.toLowerCase() === identifier.toLowerCase()
        );

        if (exactMatch) {
          console.log(`[resolve-user-identifier] Exact match found for name: ${identifier}, ID: ${exactMatch.id}`);
          // If there's an exact match, use its ID to get the email
          const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(exactMatch.id);
          if (authUserError) {
            console.error("[resolve-user-identifier] Error fetching auth user by ID:", authUserError.message);
            throw new Error(`Failed to retrieve user email: ${authUserError.message}`);
          }
          userEmail = authUser.user?.email;
        } else {
          console.log(`[resolve-user-identifier] Multiple users found with similar name: ${identifier}`);
          // Still ambiguous if no exact match among multiple partial matches
          return new Response(JSON.stringify({ error: 'Multiple users found with a similar name. Please use the exact name or email address.' }), {
            status: 409, // Conflict
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // Exactly one profile found
        console.log(`[resolve-user-identifier] Unique profile found for name: ${identifier}, ID: ${profiles[0].id}`);
        const { data: authUser, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(profiles[0].id);
        if (authUserError) {
          console.error("[resolve-user-identifier] Error fetching auth user by ID:", authUserError.message);
          throw new Error(`Failed to retrieve user email: ${authUserError.message}`);
        }
        userEmail = authUser.user?.email;
      }
    }

    if (!userEmail) {
      console.log(`[resolve-user-identifier] Could not resolve identifier to a user email: ${identifier}`);
      return new Response(JSON.stringify({ error: 'Could not resolve identifier to a user email.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[resolve-user-identifier] Successfully resolved identifier to email: ${userEmail}`);
    return new Response(JSON.stringify({ email: userEmail }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[resolve-user-identifier] Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});