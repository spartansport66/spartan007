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
    console.log(`[create-user] Received request to create/update user: ${email}, type: ${user_type}`);

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const emailConfirm = true;
    const emailConfirmedAt = new Date().toISOString();

    // --- Check if user already exists by email ---
    console.log(`[create-user] Listing users with email: ${email}`);
    const { data: existingUsersData, error: listUsersError } = await supabaseAdmin.auth.admin.listUsers({
      email: email,
    });

    if (listUsersError) {
      console.error('[create-user] Error listing users:', listUsersError.message);
      throw new Error(`Failed to check for existing user: ${listUsersError.message}`);
    }

    console.log(`[create-user] listUsers response for ${email}:`, JSON.stringify(existingUsersData));

    if (existingUsersData && existingUsersData.users.length > 0) {
      const existingUser = existingUsersData.users[0];
      console.log(`[create-user] User with email ${email} already exists (ID: ${existingUser.id}). Attempting to update.`);
      console.log(`[create-user] Existing user details:`, JSON.stringify(existingUser));

      // Defensive check: Ensure the email of the returned user actually matches the queried email
      if (existingUser.email !== email) {
        console.error(`[create-user] Mismatch: listUsers returned user with email ${existingUser.email} for requested email ${email}. This indicates an unexpected behavior in Supabase's listUsers function.`);
        // If this happens, it means Supabase is returning the wrong user for the email query.
        // We'll throw an error to highlight this, as it's a critical unexpected behavior.
        throw new Error(`Internal error: Supabase returned incorrect user for email query. Expected ${email}, got ${existingUser.email}. Please check Edge Function logs.`);
      }

      // Attempt to update the existing user
      const { data: updatedUserResponse, error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: emailConfirm,
          email_confirmed_at: emailConfirmedAt,
          ban_and_unverify: false,
          user_metadata: {
            first_name,
            last_name,
            user_type,
            is_admin: user_type === 'admin',
          },
        }
      );

      if (updateUserError) {
        console.error('[create-user] Error updating existing user:', updateUserError.message);
        return new Response(JSON.stringify({ error: `Failed to update existing user: ${updateUserError.message}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also update the public.profiles table
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .upsert(
          {
            id: existingUser.id,
            first_name,
            last_name,
            user_type,
            is_admin: user_type === 'admin',
            must_reset_password: (user_type === 'sales_person'),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (profileUpdateError) {
        console.error('[create-user] Error upserting profile for existing user:', profileUpdateError.message);
        // Don't block the user creation/update if profile update fails, but log it
      }

      return new Response(JSON.stringify({ message: `User ${email} reactivated/updated successfully as ${user_type}!`, user: updatedUserResponse.user }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      // --- Create new user ---
      console.log(`[create-user] No existing user found with email ${email}. Creating new user.`);
      const { data: userResponse, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: emailConfirm,
        email_confirmed_at: emailConfirmedAt,
        user_metadata: {
          first_name,
          last_name,
          user_type,
        },
      });

      if (userError) {
        console.error('Error creating new user:', userError.message);
        return new Response(JSON.stringify({ error: userError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ message: 'User created successfully', user: userResponse.user }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Edge Function error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});