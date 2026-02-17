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

  try {
    const { productId, name, description, opening_stock, code, size, hsn, gst, dp, category_id } = await req.json();
    
    console.log(`[update-product] Updating product: ${productId}`);

    if (!productId) {
      console.error("[update-product] Product ID is missing");
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

    const { data: currentProduct, error: fetchError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    
    if (fetchError) {
      console.error("[update-product] Error fetching current product:", fetchError);
      throw new Error(`Failed to fetch product: ${fetchError.message}`);
    }

    const updateData: any = {};

    if (code !== undefined) updateData.code = code;
    if (size !== undefined) updateData.size = size;
    if (hsn !== undefined) updateData.hsn = hsn;
    if (gst !== undefined) updateData.gst = gst;
    if (dp !== undefined) updateData.dp = Number(dp);
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category_id !== undefined) updateData.category_id = category_id;
    
    // Always recalculate closing stock based on the formula: Opening + In - Out
    const newOpening = opening_stock !== undefined ? Number(opening_stock) : (currentProduct.opening_stock || 0);
    updateData.opening_stock = newOpening;
    updateData.closing_stock = newOpening + (currentProduct.stock_in || 0) - (currentProduct.stock_out || 0);

    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      console.error("[update-product] Error updating product:", updateError);
      throw new Error(`Failed to update product: ${updateError.message}`);
    }

    // Handle production alerts based on the new closing stock
    if (updatedProduct.closing_stock < 0) {
      const newRequiredQuantity = Math.abs(updatedProduct.closing_stock);
      const { data: existingAlert } = await supabaseAdmin
        .from('production_alerts')
        .select('id')
        .eq('product_id', productId)
        .eq('resolved', false)
        .maybeSingle();

      if (existingAlert) {
        await supabaseAdmin.from('production_alerts').update({ required_quantity: newRequiredQuantity, created_at: new Date().toISOString() }).eq('id', existingAlert.id);
      } else {
        await supabaseAdmin.from('production_alerts').insert({ product_id: productId, required_quantity: newRequiredQuantity, resolved: false });
      }
    } else {
      await supabaseAdmin.from('production_alerts').update({ resolved: true }).eq('product_id', productId).eq('resolved', false);
    }

    console.log(`[update-product] Successfully updated product: ${productId}`);

    return new Response(JSON.stringify({ message: 'Product updated successfully', product: updatedProduct }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("[update-product] Unexpected error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})