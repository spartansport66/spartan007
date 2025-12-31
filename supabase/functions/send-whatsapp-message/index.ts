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
    const { dealerIds, message } = await req.json();

    if (!dealerIds || !Array.isArray(dealerIds) || dealerIds.length === 0 || !message) {
      return new Response(JSON.stringify({ error: 'Missing or invalid dealer IDs or message.' }), {
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

    for (const dealer of dealers) {
      if (dealer.phone) {
        // For simplicity, we'll return the WhatsApp Web URL.
        // Actual sending would require a WhatsApp Business API integration.
        // This approach opens a new tab for the user to manually send.
        messagesSent.push({
          dealerId: dealer.id,
          dealerName: dealer.name,
          phone: dealer.phone,
          status: 'success',
          url: `https://web.whatsapp.com/send?phone=${dealer.phone}&text=${encodeURIComponent(message)}`,
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