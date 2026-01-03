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
    const { productId, name, description, price, stock, userId: requesterId } = await req.json();

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

    const updateData: { name?: string; description?: string; price?: number; stock?: number } = {};
    let attemptedRestrictedUpdate = false;

    if (hasSales) {
      // If product has sales, only allow stock to be updated
      if (stock !== undefined) {
        updateData.stock = stock;
      }
      // Check if other fields were attempted to be updated
      if (name !== undefined && name !== null) attemptedRestrictedUpdate = true;
      if (description !== undefined && description !== null) attemptedRestrictedUpdate = true;
      if (price !== undefined && price !== null) attemptedRestrictedUpdate = true;

      if (attemptedRestrictedUpdate && Object.keys(updateData).length === 0) {
        // If only restricted fields were attempted and stock was not provided, reject
        return new Response(JSON.stringify({ error: 'Product with associated sales can only have its stock updated. Name, description, and price cannot be changed.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (attemptedRestrictedUpdate && Object.keys(updateData).length > 0 && updateData.stock !== undefined) {
        // If stock was updated, but restricted fields were also attempted, warn but proceed with stock update
        // This scenario is handled by the client-side disabling, but as a server-side safeguard.
        console.warn(`Attempted to update restricted fields for product ${productId} with sales. Only stock will be updated.`);
      }

    } else {
      // If no sales, allow all fields to be updated
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (price !== undefined) updateData.price = price;
      if (stock !== undefined) updateData.stock = stock;
    }

    if (Object.keys(updateData).length === 0) {
      return new Response(JSON.stringify({ message: 'No valid fields provided for update.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data, error } = await supabaseAdmin
      .from('products')
      .update(updateData)
      .eq('id', productId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }

    return new Response(JSON.stringify({ message: 'Product updated successfully', product: data }), {
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