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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
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
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin.from('profiles').select('user_type').eq('id', caller.id).single();
    if (profile?.user_type !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403, headers: corsHeaders });
    }

    const { email, password, first_name, last_name, user_type } = await req.json();

    const { data: allUsersData, error: listAllUsersError } = await supabaseAdmin.auth.admin.listUsers();
    if (listAllUsersError) throw new Error(`Failed to check for existing user: ${listAllUsersError.message}`);

    const existingUser = allUsersData.users.find((u: any) => u.email === email);

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

      return new Response(JSON.stringify({ message: `User ${email} reactivated/updated successfully!`, user: updatedUserResponse.user }), {
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});