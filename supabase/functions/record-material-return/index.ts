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
      const { data: saleData, error: saleError } = await supabaseAdmin
        .from('sales')
        .select('unit_price, discount_percent, gst_percent')
        .eq('order_id', order_id)
        .eq('product_id', item.product_id)
        .single();

      if (saleError || !saleData) {
        throw new Error(`Original sale record not found for product ID ${item.product_id} in order ${order_id}`);
      }

      const { unit_price, discount_percent, gst_percent } = saleData;
      const taxableValue = (unit_price * (1 - (discount_percent || 0) / 100)) * item.quantity;
      const gstAmount = (taxableValue * (gst_percent || 0)) / 100;
      const total_credit_amount = taxableValue + gstAmount;

      // Inserting into sales_returns will now automatically trigger the stock increment.
      const { error: returnError } = await supabaseAdmin
        .from('sales_returns')
        .insert({
          order_id: order_id,
          dealer_id: dealer_id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unit_price,
          discount_percent: discount_percent,
          gst_percent: gst_percent,
          total_credit_amount: total_credit_amount,
          return_date: receipt_date,
          created_by: user_id,
        });
      if (returnError) {
        throw new Error(`Failed to create sales return record: ${returnError.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, message: `${items.length} item(s) returned and credited successfully.` }), {
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