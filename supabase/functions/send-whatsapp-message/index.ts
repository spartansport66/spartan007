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
    const { dealerIds, message, comboOfferId, sentByUserId, messageType } = await req.json();

    if (!dealerIds || !Array.isArray(dealerIds) || dealerIds.length === 0 || !message || !sentByUserId) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters.' }), {
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
    if (dealersError) throw new Error(`Failed to fetch dealer phone numbers: ${dealersError.message}`);

    const logsToInsert = dealers.map(dealer => ({
      combo_offer_id: comboOfferId || null,
      dealer_id: dealer.id,
      message_content: message,
      sent_by: sentByUserId,
      message_type: messageType || 'unknown',
    }));

    if (logsToInsert.length > 0) {
      const { error: logError } = await supabaseAdmin.from('whatsapp_sent_logs').insert(logsToInsert);
      if (logError) console.error('Error inserting WhatsApp sent logs:', logError.message);
    }

    return new Response(JSON.stringify({ message: 'WhatsApp messages prepared.' }), {
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