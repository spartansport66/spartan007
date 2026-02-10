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
    // 1. Create a Supabase client with the user's auth token
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 2. Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("User not authenticated.");

    // 3. Create a Supabase admin client to bypass RLS for data fetching
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 4. Fetch dealers assigned to the sales person
    const { data: assignedDealersData, error: assignedDealersError } = await supabaseAdmin
      .from('dealer_sales_persons')
      .select(`
        dealers (
          id, 
          name, 
          credit_limit, 
          allotted_credit_days, 
          dealer_balances(opening_balance)
        )
      `)
      .eq('sales_person_id', user.id);
    if (assignedDealersError) throw assignedDealersError;

    // 5. Format the dealer data correctly
    const formattedDealers = (assignedDealersData || [])
      .filter((item: any) => item.dealers) // Filter out any null dealer records
      .map((item: any) => ({
        ...item.dealers,
        // Correctly access opening_balance from the nested array
        opening_balance: item.dealers.dealer_balances?.[0]?.opening_balance || 0
      }));
    formattedDealers.sort((a, b) => a.name.localeCompare(b.name));

    // 6. Fetch all products
    const { data: productsData, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, code, name, dp, stock');
    if (productsError) throw productsError;

    // 7. Return the data
    return new Response(JSON.stringify({ dealers: formattedDealers, products: productsData || [] }), {
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