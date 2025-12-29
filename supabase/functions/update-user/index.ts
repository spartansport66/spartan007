/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { userId, email, password, first_name, last_name, user_type, ban_and_unverify, assignedDealerIds } = await req.json();

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Update auth.users table
    const userUpdateData: { email?: string; password?: string; ban_and_unverify?: boolean; user_metadata?: { first_name?: string; last_name?: string; user_type?: string; is_admin?: boolean } } = {};
    if (email) userUpdateData.email = email;
    if (password) userUpdateData.password = password;
    if (typeof ban_and_unverify === 'boolean') userUpdateData.ban_and_unverify = ban_and_unverify;

    // Update user_metadata for the handle_new_user trigger to potentially update profile
    userUpdateData.user_metadata = {
      first_name,
      last_name,
      user_type,
      is_admin: user_type === 'admin',
    };

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      userUpdateData
    );

    if (authError) {
      console.error('Error updating auth user:', authError.message);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Update public.profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name,
        last_name,
        user_type,
        is_admin: user_type === 'admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError.message);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Update public.dealers table for sales_person assignments
    if (user_type === 'sales_person' && Array.isArray(assignedDealerIds)) {
      // Unassign dealers that are no longer in the assignedDealerIds list for this sales person
      const { error: unassignError } = await supabaseAdmin
        .from('dealers')
        .update({ sales_person_id: null })
        .eq('sales_person_id', userId)
        .not('id', 'in', assignedDealerIds);

      if (unassignError) {
        console.error('Error unassigning dealers:', unassignError.message);
        return new Response(JSON.stringify({ error: unassignError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Assign dealers that are in the assignedDealerIds list to this sales person
      if (assignedDealerIds.length > 0) {
        const { error: assignError } = await supabaseAdmin
          .from('dealers')
          .update({ sales_person_id: userId })
          .in('id', assignedDealerIds);

        if (assignError) {
          console.error('Error assigning dealers:', assignError.message);
          return new Response(JSON.stringify({ error: assignError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } else if (user_type !== 'sales_person') {
      // If user type is changed from sales_person, unassign all dealers from them
      const { error: unassignAllError } = await supabaseAdmin
        .from('dealers')
        .update({ sales_person_id: null })
        .eq('sales_person_id', userId);

      if (unassignAllError) {
        console.error('Error unassigning all dealers:', unassignAllError.message);
        return new Response(JSON.stringify({ error: unassignAllError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }


    return new Response(JSON.stringify({ message: 'User updated successfully', user: authUser }), {
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