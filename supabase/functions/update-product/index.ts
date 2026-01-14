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
    const { productId, name, description, mrp, stock, userId: requesterId, code, size, hsn, gst, dp } = await req.json();

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

    // Check if the product has any associated sales
    const { count: salesCount, error: salesCountError } = await supabaseAdmin
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId);

    if (salesCountError) {
      throw new Error(`Failed to check product sales: ${salesCountError.message}`);
    }

    const hasSales = (salesCount || 0) > 0;

    const updateData: { name?: string; description?: string; mrp?: number; stock?: number; code?: string; size?: string; hsn?: string; gst?: string; dp?: number } = {};
    let attemptedRestrictedUpdate = false;

    if (hasSales) {
      // If product has sales, only allow stock, code, size, hsn, gst, dp to be updated
      if (stock !== undefined) updateData.stock = parseInt(stock);
      if (code !== undefined) updateData.code = code;
      if (size !== undefined) updateData.size = size;
      if (hsn !== undefined) updateData.hsn = hsn;
      if (gst !== undefined) updateData.gst = gst;
      if (dp !== undefined) updateData.dp = parseInt(dp);

      // Check if other fields (name, description, mrp) were attempted to be updated
      if (name !== undefined && name !== null) attemptedRestrictedUpdate = true;
      if (description !== undefined && description !== null) attemptedRestrictedUpdate = true;
      if (mrp !== undefined && mrp !== null) attemptedRestrictedUpdate = true;

      if (attemptedRestrictedUpdate && Object.keys(updateData).length === 0) {
        // If only restricted fields were attempted and no allowed fields were provided, reject
        return new Response(JSON.stringify({ error: 'Product with associated sales can only have its stock, code, size, HSN, GST, and Dealer Price updated. Name, description, and MRP cannot be changed.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (attemptedRestrictedUpdate && Object.keys(updateData).length > 0) {
        // If allowed fields were updated, but restricted fields were also attempted, warn but proceed with allowed updates
        console.warn(`Attempted to update restricted fields for product ${productId} with sales. Only allowed fields will be updated.`);
      }

    } else {
      // If no sales, allow all fields to be updated
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (mrp !== undefined) updateData.mrp = parseInt(mrp); // Changed to parseInt
      if (stock !== undefined) updateData.stock = parseInt(stock);
      if (code !== undefined) updateData.code = code;
      if (size !== undefined) updateData.size = size;
      if (hsn !== undefined) updateData.hsn = hsn;
      if (gst !== undefined) updateData.gst = gst;
      if (dp !== undefined) updateData.dp = parseInt(dp); // Changed to parseInt
    }

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