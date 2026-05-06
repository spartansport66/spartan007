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

  const functionName = "update-user";

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error(`[${functionName}] Unauthorized: No auth header`);
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
      console.error(`[${functionName}] Invalid session:`, callerError);
      return new Response(JSON.stringify({ error: 'Invalid session' }), { status: 401, headers: corsHeaders });
    }

    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('user_type')
      .eq('id', caller.id)
      .single();

    if (profileFetchError || profile?.user_type !== 'admin') {
      console.error(`[${functionName}] Forbidden: User is not an admin`, profileFetchError);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), { status: 403, headers: corsHeaders });
    }

    const { userId, email, password, first_name, last_name, user_type, ta, ban_and_unverify, assignedDealerIds, must_reset_password } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), { status: 400, headers: corsHeaders });
    }

    console.log(`[${functionName}] Updating user: ${userId}`, { email, user_type, ban_and_unverify });

    const userUpdateData: any = {};
    if (email) userUpdateData.email = email;
    if (password) userUpdateData.password = password;
    
    // Use ban_duration instead of ban_and_unverify for API updates
    if (typeof ban_and_unverify === 'boolean') {
      userUpdateData.ban_duration = ban_and_unverify ? '87600h' : 'none'; // 10 years or none
    }

    // Fetch current user to preserve metadata
    const { data: userData, error: userFetchError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userFetchError) {
      throw new Error(`Failed to fetch user: ${userFetchError.message}`);
    }

    const currentUserMetadata = userData?.user?.user_metadata || {};
    userUpdateData.user_metadata = { ...currentUserMetadata };
    
    if (first_name !== undefined) userUpdateData.user_metadata.first_name = first_name;
    if (last_name !== undefined) userUpdateData.user_metadata.last_name = last_name;
    if (user_type !== undefined) {
      userUpdateData.user_metadata.user_type = user_type;
      userUpdateData.user_metadata.is_admin = user_type === 'admin';
    }

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, userUpdateData);
    if (authError) {
      console.error(`[${functionName}] Auth update failed:`, authError);
      throw new Error(`Auth update failed: ${authError.message}`);
    }

    // Update public.profiles table
    const profileUpdateData: any = { updated_at: new Date().toISOString() };
    if (first_name !== undefined) profileUpdateData.first_name = first_name;
    if (last_name !== undefined) profileUpdateData.last_name = last_name;
    if (user_type !== undefined) {
      profileUpdateData.user_type = user_type;
      profileUpdateData.is_admin = user_type === 'admin';
    }
    if (ta !== undefined) profileUpdateData.ta = ta;
    if (must_reset_password !== undefined) profileUpdateData.must_reset_password = must_reset_password;

    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdateData)
      .eq('id', userId);

    if (profileUpdateError) {
      console.error(`[${functionName}] Profile update failed:`, profileUpdateError);
      throw new Error(`Profile update failed: ${profileUpdateError.message}`);
    }

    // Handle dealer assignments if applicable
    if (user_type === 'sales_person' && Array.isArray(assignedDealerIds)) {
      const { data: currentAssignments, error: fetchAssignError } = await supabaseAdmin
        .from('dealer_sales_persons')
        .select('dealer_id')
        .eq('sales_person_id', userId);

      if (fetchAssignError) throw new Error(`Fetching assignments failed: ${fetchAssignError.message}`);
      
      const currentDealerIds = currentAssignments?.map((a: any) => a.dealer_id) || [];
      const toAdd = assignedDealerIds.filter((id: string) => !currentDealerIds.includes(id));
      const toRemove = currentDealerIds.filter((id: string) => !assignedDealerIds.includes(id));

      if (toAdd.length > 0) {
        const { error: addError } = await supabaseAdmin
          .from('dealer_sales_persons')
          .insert(toAdd.map((dealerId: string) => ({ dealer_id: dealerId, sales_person_id: userId })));
        if (addError) throw new Error(`Assigning dealers failed: ${addError.message}`);
      }
      if (toRemove.length > 0) {
        const { error: removeError } = await supabaseAdmin
          .from('dealer_sales_persons')
          .delete()
          .eq('sales_person_id', userId)
          .in('dealer_id', toRemove);
        if (removeError) throw new Error(`Unassigning dealers failed: ${removeError.message}`);
      }
    }

    return new Response(JSON.stringify({ message: 'User updated successfully', user: authUser }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error(`[${functionName}] Unexpected error:`, error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});