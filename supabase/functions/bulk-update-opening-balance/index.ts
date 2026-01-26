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
      // Temporarily include gstin in update object for logging purposes, but don't use it for matching/updating
      const { dealerName, phoneNumber, gstin, openingBalance, lastBillingDate } = update;

      try {
        // 1. Find the dealer ID using name and optional phone number
        let dealerQuery = supabaseAdmin
          .from('dealers')
          .select('id')
          .eq('name', dealerName);
        
        // Use OR condition for matching by phone if provided, otherwise rely only on name
        const matchConditions = [];
        if (phoneNumber) {
          matchConditions.push(`phone.eq.${phoneNumber}`);
        }
        // GSTIN matching is temporarily removed here
        
        if (matchConditions.length > 0) {
            dealerQuery = dealerQuery.or(matchConditions.join(','));
        }

        const { data: dealerData, error: dealerFetchError } = await dealerQuery.limit(1).single();

        if (dealerFetchError || !dealerData) {
          // Include gstin in notFound log for user reference
          results.notFound.push({ dealerName, phoneNumber, gstin, openingBalance, lastBillingDate });
          continue;
        }

        const dealerId = dealerData.id;
        let dealerUpdateData: { last_billing_date?: string | null } = {}; // Removed gstin update

        // 2. Update last_billing_date in dealers table
        if (lastBillingDate) {
            dealerUpdateData.last_billing_date = lastBillingDate;
        }
        
        // 3. GSTIN update logic is temporarily removed
        
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