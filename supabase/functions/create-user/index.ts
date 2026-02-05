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
    const { email, password, first_name, last_name, user_type } = await req.json();

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: allUsersData, error: listAllUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (listAllUsersError) throw new Error(`Failed to check for existing user: ${listAllUsersError.message}`);

    const existingUser = allUsersData.users.find(u => u.email === email);

    if (existingUser) {
      const { data: updatedUserResponse, error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: true,
          email_confirmed_at: new Date().toISOString(),
          ban_and_unverify: false,
          user_metadata: { first_name, last_name, user_type, is_admin: user_type === 'admin' },
        }
      );
      if (updateUserError) throw new Error(`Failed to update existing user: ${updateUserError.message}`);
      
      await supabaseAdmin.from('profiles').upsert({
        id: existingUser.id,
        first_name,
        last_name,
        user_type,
        is_admin: user_type === 'admin',
        must_reset_password: (user_type === 'sales_person'),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      return new Response(JSON.stringify({ message: `User ${email} reactivated/updated successfully as ${user_type}!`, user: updatedUserResponse.user }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      const { data: userResponse, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        email_confirmed_at: new Date().toISOString(),
        user_metadata: { first_name, last_name, user_type },
      });
      if (userError) throw userError;

      return new Response(JSON.stringify({ message: 'User created successfully', user: userResponse.user }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});