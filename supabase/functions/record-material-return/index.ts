// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { order_id, user_id, remarks, receipt_date, items } = await req.json();

    if (!order_id || !user_id || !receipt_date || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
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

    // Fetch dealer_id from the order
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('dealer_id')
      .eq('id', order_id)
      .single();

    if (orderError || !orderData) {
      throw new Error(`Failed to fetch order details: ${orderError?.message || 'Order not found'}`);
    }
    const dealer_id = orderData.dealer_id;

    for (const item of items) {
      // 1. Update stock via RPC
      const { error: stockError } = await supabaseAdmin.rpc('increment_stock', {
        product_id_in: item.product_id,
        quantity_in: item.quantity
      });
      if (stockError) {
        console.warn(`[record-material-return] Failed to update stock for product ${item.product_id}: ${stockError.message}`);
      }

      // 2. Insert stock receipt log
      const { error: logError } = await supabaseAdmin
        .from('stock_receipts')
        .insert({
          product_id: item.product_id,
          quantity: item.quantity,
          receipt_date: receipt_date,
          received_by: user_id,
          remarks: remarks,
          dealer_id: dealer_id,
          order_id: order_id,
        });
      if (logError) {
        throw new Error(`Failed to save history log for product ${item.product_id}: ${logError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `${items.length} item(s) returned successfully.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[record-material-return] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});