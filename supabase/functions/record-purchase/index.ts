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
    const { supplier_id, purchase_date, items, user_id } = await req.json();

    if (!purchase_date || !items || !Array.isArray(items) || items.length === 0 || !user_id) {
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

    const total_amount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    const { data: purchaseData, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .insert({ supplier_id: supplier_id || null, purchase_date, total_amount, created_by: user_id })
      .select('id')
      .single();
    if (purchaseError) throw new Error(`Failed to create purchase record: ${purchaseError.message}`);
    const purchase_id = purchaseData.id;

    const purchaseItemsToInsert = items.map(item => ({
      purchase_id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.quantity * item.unit_price,
    }));
    const { error: itemsError } = await supabaseAdmin.from('purchase_items').insert(purchaseItemsToInsert);
    if (itemsError) throw new Error(`Failed to record purchase items: ${itemsError.message}`);

    for (const item of items) {
      const { error: stockUpdateError } = await supabaseAdmin.rpc('increment_stock', {
        product_id_in: item.product_id,
        quantity_in: item.quantity
      });
      if (stockUpdateError) console.warn(`Failed to update stock for product ${item.product_id}: ${stockUpdateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, purchaseId: purchase_id }), {
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