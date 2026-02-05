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
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, email, password, first_name, last_name, user_type, ban_and_unverify, assignedDealerIds, must_reset_password } = await req.json();

    // Create a Supabase client with the service role key
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Update auth.users table
    const userUpdateData: { email?: string; password?: string; ban_and_unverify?: boolean; user_metadata?: { first_name?: string; last_name?: string; user_type?: string; is_admin?: boolean } } = {};
    if (email) userUpdateData.email = email;
    if (password) userUpdateData.password = password;
    if (typeof ban_and_unverify === 'boolean') userUpdateData.ban_and_unverify = ban_and_unverify;

    // Update user_metadata for the handle_new_user trigger to potentially update profile
    // Only update if these fields are explicitly provided, otherwise keep existing metadata
    const currentUserMetadata = (await supabaseAdmin.auth.admin.getUserById(userId)).data?.user?.user_metadata || {};
    userUpdateData.user_metadata = {
      ...currentUserMetadata, // Keep existing metadata
      ...(first_name !== undefined && { first_name }),
      ...(last_name !== undefined && { last_name }),
      ...(user_type !== undefined && { user_type }),
      ...(user_type !== undefined && { is_admin: user_type === 'admin' }),
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
    const profileUpdateData: { first_name?: string; last_name?: string; user_type?: string; is_admin?: boolean; must_reset_password?: boolean; updated_at?: string } = {};
    if (first_name !== undefined) profileUpdateData.first_name = first_name;
    if (last_name !== undefined) profileUpdateData.last_name = last_name;
    if (user_type !== undefined) profileUpdateData.user_type = user_type;
    if (user_type !== undefined) profileUpdateData.is_admin = user_type === 'admin';
    if (must_reset_password !== undefined) profileUpdateData.must_reset_password = must_reset_password; // Update must_reset_password
    profileUpdateData.updated_at = new Date().toISOString();

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', userId);

    if (profileError) {
      console.error('Error updating profile:', profileError.message);
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Update public.dealer_sales_persons table for sales_person assignments
    if (user_type === 'sales_person' && Array.isArray(assignedDealerIds)) {
      // Fetch current assignments for this sales person
      const { data: currentAssignments, error: fetchError } = await supabaseAdmin
        .from('dealer_sales_persons')
        .select('dealer_id')
        .eq('sales_person_id', userId);

      if (fetchError) {
        console.error('Error fetching current dealer assignments:', fetchError.message);
        return new Response(JSON.stringify({ error: fetchError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const currentDealerIds = currentAssignments?.map(a => a.dealer_id) || [];

      const toAdd = assignedDealerIds.filter((id: string) => !currentDealerIds.includes(id));
      const toRemove = currentDealerIds.filter((id: string) => !assignedDealerIds.includes(id));

      if (toAdd.length > 0) {
        const { error: addError } = await supabaseAdmin
          .from('dealer_sales_persons')
          .insert(toAdd.map((dealerId: string) => ({ dealer_id: dealerId, sales_person_id: userId })));
        if (addError) {
          console.error('Error assigning dealers:', addError.message);
          return new Response(JSON.stringify({ error: addError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (toRemove.length > 0) {
        const { error: removeError } = await supabaseAdmin
          .from('dealer_sales_persons')
          .delete()
          .eq('sales_person_id', userId)
          .in('dealer_id', toRemove);
        if (removeError) {
          console.error('Error unassigning dealers:', removeError.message);
          return new Response(JSON.stringify({ error: removeError.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } else if (user_type !== 'sales_person') {
      // If user type is changed from sales_person, unassign all dealers from them
      const { error: unassignAllError } = await supabaseAdmin
        .from('dealer_sales_persons')
        .delete()
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