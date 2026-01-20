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

    // Determine if must_reset_password should be true
    const mustResetPassword = (user_type === 'sales_person' || user_type === 'item_manager');
    const isAdminUser = user_type === 'admin';

    // --- WORKAROUND: Fetch all users and filter manually by email ---
    console.log(`[create-user] Fetching all users to manually check for email: ${email}`);
    const { data: allUsersData, error: listAllUsersError } = await supabaseAdmin.auth.admin.listUsers();

    if (listAllUsersError) {
      console.error('[create-user] Error listing all users:', listAllUsersError.message);
      throw new Error(`Failed to check for existing user (list all): ${listAllUsersError.message}`);
    }

    const existingUser = allUsersData.users.find(u => u.email === email);
    console.log(`[create-user] Manual filter result for ${email}:`, existingUser ? `Found user ID: ${existingUser.id}` : 'No user found.');

    if (existingUser) {
      console.log(`[create-user] User with email ${email} found (ID: ${existingUser.id}). Attempting to update.`);

      // Attempt to update the existing user
      const { data: updatedUserResponse, error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: emailConfirm,
          email_confirmed_at: emailConfirmedAt,
          ban_and_unverify: false, // Unban if they were banned
          user_metadata: {
            first_name,
            last_name,
            user_type,
            is_admin: isAdminUser, // Set is_admin based on user_type
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
            is_admin: isAdminUser, // Set is_admin based on user_type
            must_reset_password: mustResetPassword, // Set must_reset_password
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
          is_admin: isAdminUser, // Set is_admin based on user_type
        },
      });

      if (userError) {
        console.error('Error creating new user:', userError.message);
        return new Response(JSON.stringify({ error: userError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // After creating the user in auth.users, the handle_new_user trigger will create the profile.
      // We need to explicitly update must_reset_password in the profile table.
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ must_reset_password: mustResetPassword })
        .eq('id', userResponse.user?.id);

      if (profileUpdateError) {
        console.error('[create-user] Error updating must_reset_password for new user profile:', profileUpdateError.message);
        // Log error but don't block, as user is created.
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