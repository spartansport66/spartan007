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
    const { updates } = await req.json();

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No update data provided.' }), {
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

    const results = {
      successCount: 0,
      notFound: [] as { name: string; phone: string | null; openingBalance: number; lastBillingDate: string | null }[],
      errorCount: 0,
    };

    for (const update of updates) {
      const { dealerName, phoneNumber, openingBalance, lastBillingDate } = update;

      try {
        // 1. Find the dealer ID using name and phone (or just name if phone is missing)
        let dealerQuery = supabaseAdmin
          .from('dealers')
          .select('id')
          .eq('name', dealerName)
          .limit(1);
        
        if (phoneNumber) {
          dealerQuery = dealerQuery.eq('phone', phoneNumber);
        }

        const { data: dealerData, error: dealerFetchError } = await dealerQuery.single();

        if (dealerFetchError || !dealerData) {
          results.notFound.push({ dealerName, phoneNumber, openingBalance, lastBillingDate });
          continue;
        }

        const dealerId = dealerData.id;

        // 2. Upsert opening balance into dealer_balances
        const { error: balanceUpsertError } = await supabaseAdmin
          .from('dealer_balances')
          .upsert(
            {
              dealer_id: dealerId,
              opening_balance: openingBalance,
              // Note: We don't update closing_balance here; it's calculated dynamically.
            },
            { onConflict: 'dealer_id' }
          );

        if (balanceUpsertError) {
          console.error(`[bulk-update-opening-balance] Error upserting balance for ${dealerName}:`, balanceUpsertError.message);
          results.errorCount++;
          continue;
        }
        
        // 3. Update last_billing_date in dealers table
        if (lastBillingDate) {
            const { error: dateUpdateError } = await supabaseAdmin
                .from('dealers')
                .update({ last_billing_date: lastBillingDate })
                .eq('id', dealerId);

            if (dateUpdateError) {
                console.error(`[bulk-update-opening-balance] Error updating last_billing_date for ${dealerName}:`, dateUpdateError.message);
                // Log error but continue
            }
        }

        results.successCount++;

      } catch (e) {
        console.error(`[bulk-update-opening-balance] Unexpected error processing ${dealerName}:`, e.message);
        results.errorCount++;
      }
    }

    return new Response(JSON.stringify({ message: 'Bulk update completed.', results }), {
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