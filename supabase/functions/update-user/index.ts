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
    const { userId, email, password, first_name, last_name, user_type, ban_and_unverify, assignedDealerIds, must_reset_password } = await req.json();

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const userUpdateData: any = {};
    if (email) userUpdateData.email = email;
    if (password) userUpdateData.password = password;
    if (typeof ban_and_unverify === 'boolean') userUpdateData.ban_and_unverify = ban_and_unverify;

    const currentUserMetadata = (await supabaseAdmin.auth.admin.getUserById(userId)).data?.user?.user_metadata || {};
    userUpdateData.user_metadata = { ...currentUserMetadata };
    if (first_name !== undefined) userUpdateData.user_metadata.first_name = first_name;
    if (last_name !== undefined) userUpdateData.user_metadata.last_name = last_name;
    if (user_type !== undefined) {
      userUpdateData.user_metadata.user_type = user_type;
      userUpdateData.user_metadata.is_admin = user_type === 'admin';
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, userUpdateData);
    if (authError) throw new Error(`Auth update failed: ${authError.message}`);

    const profileUpdateData: any = { updated_at: new Date().toISOString() };
    if (first_name !== undefined) profileUpdateData.first_name = first_name;
    if (last_name !== undefined) profileUpdateData.last_name = last_name;
    if (user_type !== undefined) {
      profileUpdateData.user_type = user_type;
      profileUpdateData.is_admin = user_type === 'admin';
    }
    if (must_reset_password !== undefined) profileUpdateData.must_reset_password = must_reset_password;

    const { error: profileError } = await supabaseAdmin.from('profiles').update(profileUpdateData).eq('id', userId);
    if (profileError) throw new Error(`Profile update failed: ${profileError.message}`);

    if (user_type === 'sales_person' && Array.isArray(assignedDealerIds)) {
      const { data: currentAssignments, error: fetchError } = await supabaseAdmin.from('dealer_sales_persons').select('dealer_id').eq('sales_person_id', userId);
      if (fetchError) throw new Error(`Fetching assignments failed: ${fetchError.message}`);
      
      const currentDealerIds = currentAssignments?.map(a => a.dealer_id) || [];
      const toAdd = assignedDealerIds.filter((id: string) => !currentDealerIds.includes(id));
      const toRemove = currentDealerIds.filter((id: string) => !assignedDealerIds.includes(id));

      if (toAdd.length > 0) {
        const { error: addError } = await supabaseAdmin.from('dealer_sales_persons').insert(toAdd.map((dealerId: string) => ({ dealer_id: dealerId, sales_person_id: userId })));
        if (addError) throw new Error(`Assigning dealers failed: ${addError.message}`);
      }
      if (toRemove.length > 0) {
        const { error: removeError } = await supabaseAdmin.from('dealer_sales_persons').delete().eq('sales_person_id', userId).in('dealer_id', toRemove);
        if (removeError) throw new Error(`Unassigning dealers failed: ${removeError.message}`);
      }
    } else if (user_type !== 'sales_person') {
      const { error: unassignAllError } = await supabaseAdmin.from('dealer_sales_persons').delete().eq('sales_person_id', userId);
      if (unassignAllError) throw new Error(`Unassigning all dealers failed: ${unassignAllError.message}`);
    }

    return new Response(JSON.stringify({ message: 'User updated successfully', user: authUser }), {
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