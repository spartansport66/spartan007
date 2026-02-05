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
    const { productId, name, description, stock, userId: requesterId, code, size, hsn, gst, dp } = await req.json();

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

    const updateData: { name?: string; description?: string; stock?: number; code?: string; size?: string; hsn?: string; gst?: string; dp?: number } = {};

    // Always allow all fields to be updated
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (stock !== undefined) updateData.stock = parseInt(stock);
    if (code !== undefined) updateData.code = code;
    if (size !== undefined) updateData.size = size;
    if (hsn !== undefined) updateData.hsn = hsn;
    if (gst !== undefined) updateData.gst = gst;
    if (dp !== undefined) updateData.dp = parseInt(dp);

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ message: 'No valid fields provided for update.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform the product update
    const { data: updatedProduct, error: updateError } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update product: ${updateError.message}`);
    }

    // --- Manage Production Alerts based on the NEW stock level ---
    // This logic runs if stock was updated, regardless of whether the product has sales or not.
    if (updateData.stock !== undefined) {
        if (updatedProduct.stock < 0) {
            // New stock is negative. Ensure an alert exists with the correct quantity.
            const newRequiredQuantity = Math.abs(updatedProduct.stock);

            // Check for an existing unresolved alert
            const { data: existingAlert, error: fetchAlertError } = await supabaseAdmin
                .from('production_alerts')
                .select('id')
                .eq('product_id', productId)
                .eq('resolved', false)
                .single();

            if (fetchAlertError && fetchAlertError.code !== 'PGRST116') { // PGRST116 means "no rows found"
                console.error(`Error fetching existing alert for product ${productId}:`, fetchAlertError.message);
                // Continue, but log the error
            }

            if (existingAlert) {
                // Update existing alert with the new required quantity
                const { error: updateAlertError } = await supabaseAdmin
                    .from('production_alerts')
                    .update({
                        required_quantity: newRequiredQuantity,
                        // Optionally update timestamp
                        created_at: new Date().toISOString(),
                    })
                    .eq('id', existingAlert.id);

                if (updateAlertError) {
                    console.error(`Failed to update production alert for product ${productId}:`, updateAlertError.message);
                    // Don't throw, as the main update succeeded. Log the error.
                }
            } else {
                // No existing alert, insert a new one.
                // Note: We don't have dealer_id or created_by here for a direct stock update.
                // These fields are optional in the schema, so we can insert without them.
                const { error: insertAlertError } = await supabaseAdmin
                    .from('production_alerts')
                    .insert({
                        product_id: productId,
                        required_quantity: newRequiredQuantity,
                        resolved: false,
                        // created_by and dealer_id are optional and omitted
                    });

                if (insertAlertError) {
                    console.error(`Failed to insert new production alert for product ${productId}:`, insertAlertError.message);
                    // Don't throw, as the main update succeeded. Log the error.
                }
            }
        } else {
            // New stock is zero or positive. Resolve any existing unresolved alerts.
            const { error: resolveAlertsError } = await supabaseAdmin
                .from('production_alerts')
                .update({ resolved: true })
                .eq('product_id', productId)
                .eq('resolved', false);

            if (resolveAlertsError) {
                console.error(`Failed to resolve production alerts for product ${productId}:`, resolveAlertsError.message);
                // Don't throw, as the main update succeeded. Log the error.
            }
        }
    }
    // --- End of Production Alerts Management ---

    return new Response(JSON.stringify({ message: 'Product updated successfully', product: updatedProduct }), {
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