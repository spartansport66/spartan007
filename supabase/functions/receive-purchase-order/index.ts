// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { purchase_order_id, items, receipt_date, received_by } = await req.json();

    if (!purchase_order_id || !Array.isArray(items) || items.length === 0 || !receipt_date || !received_by) {
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

    // Process each item
    for (const item of items) {
      if (item.quantity_received > 0) {
        // 1. Increment quantity_received on the PO item
        const { error: updateItemError } = await supabaseAdmin.rpc('increment_po_item_received', {
          p_po_item_id: item.po_item_id,
          p_quantity: item.quantity_received
        });
        if (updateItemError) throw new Error(`Failed to update PO item: ${updateItemError.message}`);

        // 2. Increment stock for the raw material
        const { error: stockUpdateError } = await supabaseAdmin.rpc('increment_raw_material_stock', {
          p_material_id: item.raw_material_id,
          p_quantity: item.quantity_received
        });
        if (stockUpdateError) throw new Error(`Failed to update stock: ${stockUpdateError.message}`);
      }
    }

    // 3. Update PO status
    const { data: allItems, error: fetchItemsError } = await supabaseAdmin
      .from('purchase_order_items')
      .select('quantity, quantity_received')
      .eq('purchase_order_id', purchase_order_id);
    
    if (fetchItemsError) throw fetchItemsError;

    const fullyReceived = allItems.every((item: { quantity: number; quantity_received: number }) => item.quantity_received >= item.quantity);
    const partiallyReceived = allItems.some((item: { quantity_received: number }) => item.quantity_received > 0);
    
    let newStatus = 'Submitted';
    if (fullyReceived) {
      newStatus = 'Completed';
    } else if (partiallyReceived) {
      newStatus = 'Partially Received';
    }

    const { error: poUpdateError } = await supabaseAdmin
      .from('purchase_orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', purchase_order_id);

    if (poUpdateError) throw poUpdateError;

    return new Response(JSON.stringify({ success: true, message: `Successfully received items. PO status is now ${newStatus}.` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[receive-purchase-order] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper RPC function to increment po_item_received
/*
CREATE OR REPLACE FUNCTION increment_po_item_received(p_po_item_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.purchase_order_items
  SET quantity_received = quantity_received + p_quantity
  WHERE id = p_po_item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/