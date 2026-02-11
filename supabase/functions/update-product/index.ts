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
    const { productId, name, description, opening_stock, code, size, hsn, gst, dp } = await req.json();
    if (!productId) {
      return new Response(JSON.stringify({ error: 'Product ID is required.' }), {
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

    // Fetch current product data to calculate new closing stock
    const { data: currentProduct, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    
    if (fetchError) throw new Error(`Failed to fetch product: ${fetchError.message}`);

    const { count: salesCount, error: salesCountError } = await supabaseAdmin
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);
    if (salesCountError) throw new Error(`Failed to check product sales: ${salesCountError.message}`);

    const hasSales = (salesCount || 0) > 0;
    const updateData: any = {};

    // Common fields
    if (code !== undefined) updateData.code = code;
    if (size !== undefined) updateData.size = size;
    if (hsn !== undefined) updateData.hsn = hsn;
    if (gst !== undefined) updateData.gst = gst;
    if (dp !== undefined) updateData.dp = parseInt(dp);
    
    if (opening_stock !== undefined) {
      const newOpening = parseInt(opening_stock);
      updateData.opening_stock = newOpening;
      // Recalculate closing stock: Opening + In - Out
      updateData.closing_stock = newOpening + currentProduct.stock_in - currentProduct.stock_out;
    }

    // Fields only editable if no sales exist
    if (!hasSales) {
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ message: 'No valid fields provided for update.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();
    if (updateError) throw new Error(`Failed to update product: ${updateError.message}`);

    // Handle production alerts based on new closing stock
    if (updatedProduct.closing_stock < 0) {
      const newRequiredQuantity = Math.abs(updatedProduct.closing_stock);
      const { data: existingAlert } = await supabaseAdmin.from('production_alerts').select('id').eq('product_id', productId).eq('resolved', false).single();
      if (existingAlert) {
        await supabaseAdmin.from('production_alerts').update({ required_quantity: newRequiredQuantity, created_at: new Date().toISOString() }).eq('id', existingAlert.id);
      } else {
        await supabaseAdmin.from('production_alerts').insert({ product_id: productId, required_quantity: newRequiredQuantity, resolved: false });
      }
    } else {
      await supabaseAdmin.from('production_alerts').update({ resolved: true }).eq('product_id', productId).eq('resolved', false);
    }

    return new Response(JSON.stringify({ message: 'Product updated successfully', product: updatedProduct }), {
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