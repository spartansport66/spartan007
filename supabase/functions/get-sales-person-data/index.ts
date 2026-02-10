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
    // Create a Supabase client with the user's authentication token
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error("User not authenticated.");

    // Create a Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch dealers assigned to the authenticated user
    const { data: assignedDealersData, error: assignedDealersError } = await supabaseAdmin
      .from('dealer_sales_persons')
      .select(`dealers(id, name, credit_limit, allotted_credit_days, dealer_balances(opening_balance))`)
      .eq('sales_person_id', user.id);
    if (assignedDealersError) throw assignedDealersError;

    const formattedDealers = (assignedDealersData || [])
      .map((item: any) => {
        if (!item.dealers) {
          return null;
        }
        // Handle dealer_balances which can be an object or null
        const opening_balance = item.dealers.dealer_balances?.opening_balance || 0;
        
        // Return a new object without the nested dealer_balances
        const { dealer_balances, ...dealerData } = item.dealers;
        
        return {
          ...dealerData,
          opening_balance,
        };
      })
      .filter(Boolean); // Remove null entries

    formattedDealers.sort((a, b) => a.name.localeCompare(b.name));

    // Fetch all products
    const { data: productsData, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, code, name, dp, stock');
    if (productsError) throw productsError;

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