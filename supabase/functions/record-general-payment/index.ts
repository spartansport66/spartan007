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
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dealerId, amount } = await req.json();

    if (!dealerId || typeof amount !== 'number' || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid dealerId or amount.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch current dealer balance
    const { data: currentBalanceData, error: fetchBalanceError } = await supabaseAdmin
      .from('dealer_balances')
      .select('opening_balance')
      .eq('dealer_id', dealerId)
      .single();

    if (fetchBalanceError && fetchBalanceError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch current balance: ${fetchBalanceError.message}`);
    }
    
    const currentOpeningBalance = currentBalanceData?.opening_balance || 0;
    const newOpeningBalance = Math.max(0, currentOpeningBalance - amount);

    // 2. Update dealer_balances table
    const { error: balanceUpdateError } = await supabaseAdmin
      .from('dealer_balances')
      .upsert({
        dealer_id: dealerId,
        opening_balance: newOpeningBalance,
      }, { onConflict: 'dealer_id' });

    if (balanceUpdateError) {
      throw new Error(`Failed to update dealer balance: ${balanceUpdateError.message}`);
    }

    return new Response(JSON.stringify({ 
      message: 'General payment recorded successfully.',
      new_opening_balance: newOpeningBalance
    }), {
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