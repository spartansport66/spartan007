/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { products: productData } = await req.json();

    if (!productData || !Array.isArray(productData) || productData.length === 0) {
      return new Response(JSON.stringify({ error: 'No product data provided for bulk upload.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const productsToInsert = productData.map((product: any) => ({
      name: product.name,
      description: product.description || null,
      mrp: parseInt(product.mrp), // Changed to parseInt
      stock: parseInt(product.stock),
      user_id: product.user_id,
      code: product.code,
      size: product.size || null,
      hsn: product.hsn || null,
      gst: product.gst || null, // Handled as text
      dp: parseInt(product.dp), // Changed to parseInt
    }));

    const { data, error } = await supabaseAdmin
      .from('products')
      .insert(productsToInsert)
      .select();

    if (error) {
      console.error('Error during bulk product insert:', error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ message: `${data.length} products added successfully!`, products: data }), {
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