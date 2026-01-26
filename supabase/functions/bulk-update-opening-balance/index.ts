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
      notFound: [] as { dealerName: string; phoneNumber: string | null; gstin: string | null; openingBalance: number; lastBillingDate: string | null }[],
      errorCount: 0,
    };

    for (const update of updates) {
      const { dealerName, phoneNumber, gstin, openingBalance, lastBillingDate } = update;

      try {
        // 1. Find the dealer ID using name, optional phone number, and optional gstin
        let dealerQuery = supabaseAdmin
          .from('dealers')
          .select('id, gstin') // Select existing gstin to check if we need to update it
          .eq('name', dealerName);
        
        // Use OR condition for matching by phone or gstin if provided, otherwise rely only on name
        const matchConditions = [];
        if (phoneNumber) {
          matchConditions.push(`phone.eq.${phoneNumber}`);
        }
        if (gstin) {
          matchConditions.push(`gstin.eq.${gstin}`);
        }
        
        if (matchConditions.length > 0) {
            dealerQuery = dealerQuery.or(matchConditions.join(','));
        }

        const { data: dealerData, error: dealerFetchError } = await dealerQuery.limit(1).single();

        if (dealerFetchError || !dealerData) {
          results.notFound.push({ dealerName, phoneNumber, gstin, openingBalance, lastBillingDate });
          continue;
        }

        const dealerId = dealerData.id;
        let dealerUpdateData: { last_billing_date?: string | null; gstin?: string | null } = {};

        // 2. Update last_billing_date in dealers table
        if (lastBillingDate) {
            dealerUpdateData.last_billing_date = lastBillingDate;
        }
        
        // 3. Update GSTIN in dealers table if provided and different
        if (gstin && dealerData.gstin !== gstin) {
            dealerUpdateData.gstin = gstin;
        }
        
        if (Object.keys(dealerUpdateData).length > 0) {
            const { error: dealerUpdateError } = await supabaseAdmin
                .from('dealers')
                .update(dealerUpdateData)
                .eq('id', dealerId);

            if (dealerUpdateError) {
                console.error(`[bulk-update-opening-balance] Error updating dealer details for ${dealerName}:`, dealerUpdateError.message);
                // Log error but continue
            }
        }

        // 4. Upsert opening balance into dealer_balances
        const { error: balanceUpsertError } = await supabaseAdmin
          .from('dealer_balances')
          .upsert(
            {
              dealer_id: dealerId,
              opening_balance: openingBalance,
            },
            { onConflict: 'dealer_id' }
          );

        if (balanceUpsertError) {
          console.error(`[bulk-update-opening-balance] Error upserting balance for ${dealerName}:`, balanceUpsertError.message);
          results.errorCount++;
          continue;
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