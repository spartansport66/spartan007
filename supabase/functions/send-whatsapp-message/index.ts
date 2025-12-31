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
    const { dealerIds, message, comboOfferId, sentByUserId } = await req.json(); // Added comboOfferId and sentByUserId

    if (!dealerIds || !Array.isArray(dealerIds) || dealerIds.length === 0 || !message || !comboOfferId || !sentByUserId) {
      return new Response(JSON.stringify({ error: 'Missing or invalid dealer IDs, message, combo offer ID, or sender user ID.' }), {
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

    const { data: dealers, error: dealersError } = await supabaseAdmin
      .from('dealers')
      .select('id, name, phone')
      .in('id', dealerIds);

    if (dealersError) {
      throw new Error(`Failed to fetch dealer phone numbers: ${dealersError.message}`);
    }

    const messagesSent: { dealerId: string; dealerName: string; phone: string; status: string; url?: string; error?: string }[] = [];
    const logsToInsert: { combo_offer_id: string; dealer_id: string; message_content: string; sent_by: string }[] = [];

    for (const dealer of dealers) {
      if (dealer.phone) {
        messagesSent.push({
          dealerId: dealer.id,
          dealerName: dealer.name,
          phone: dealer.phone,
          status: 'success',
          url: `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodeURIComponent(message)}`,
        });
        logsToInsert.push({
          combo_offer_id: comboOfferId,
          dealer_id: dealer.id,
          message_content: message,
          sent_by: sentByUserId,
        });
      } else {
        messagesSent.push({
          dealerId: dealer.id,
          dealerName: dealer.name,
          phone: 'N/A',
          status: 'failed',
          error: 'Phone number not available for this dealer.',
        });
      }
    }

    // Insert logs into the database
    if (logsToInsert.length > 0) {
      const { error: logError } = await supabaseAdmin
        .from('whatsapp_sent_logs')
        .insert(logsToInsert);

      if (logError) {
        console.error('Error inserting WhatsApp sent logs:', logError.message);
        // Continue to return message results even if logging fails
      }
    }

    return new Response(JSON.stringify({ message: 'WhatsApp messages prepared.', results: messagesSent }), {
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