// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// @ts-ignore
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const functionName = "record-direct-purchase";

  try {
    const { supplier_id, bill_no, bill_date, items, user_id, remarks } = await req.json();

    if (!supplier_id || !bill_no || !bill_date || !Array.isArray(items) || items.length === 0 || !user_id) {
      console.error(`[${functionName}] Missing required fields.`);
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

    // 1. Create Purchase Voucher
    const { data: voucher, error: voucherError } = await supabaseAdmin
      .from('purchase_vouchers')
      .insert({
        purchase_order_id: null, // Explicitly set to null for direct purchase
        supplier_id: supplier_id,
        receipt_date: bill_date,
        received_by: user_id,
        supplier_invoice_no: bill_no,
        supplier_invoice_date: bill_date,
        remarks: remarks,
      })
      .select('id')
      .single();
    if (voucherError) throw new Error(`Failed to create purchase voucher: ${voucherError.message}`);

    // 2. Create Purchase Voucher Items and update stock
    for (const item of items) {
      // Insert item into voucher
      const { error: itemError } = await supabaseAdmin
        .from('purchase_voucher_items')
        .insert({
          purchase_voucher_id: voucher.id,
          raw_material_id: item.raw_material_id,
          quantity_received: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          gst_percent: item.gst_percent,
        });
      if (itemError) throw new Error(`Failed to create voucher item for ${item.raw_material_id}: ${itemError.message}`);

      // Increment stock for the raw material
      const { error: stockUpdateError } = await supabaseAdmin.rpc('increment_raw_material_stock', {
        p_material_id: item.raw_material_id,
        p_quantity: item.quantity
      });
      if (stockUpdateError) throw new Error(`Failed to update stock for ${item.raw_material_id}: ${stockUpdateError.message}`);
    }

    console.log(`[${functionName}] Successfully recorded purchase bill #${bill_no}`);
    return new Response(JSON.stringify({ success: true, message: `Purchase Bill #${bill_no} recorded successfully.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error(`[${functionName}] Error:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})