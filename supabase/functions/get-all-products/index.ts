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
    console.log("[get-all-products] Fetching all products");

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: productsData, error: productsError } = await supabaseAdmin
      .from('products')
      .select('id, code, name, dp, opening_stock, stock_in, stock_out, closing_stock')
      // All products (including inactive)
      .order('name', { ascending: true });
    
    if (productsError) {
      console.error("[get-all-products] Database error:", productsError);
      throw productsError;
    }

    console.log(`[get-all-products] Successfully fetched ${productsData?.length || 0} products`);

    return new Response(JSON.stringify({ products: productsData || [] }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("[get-all-products] Unexpected error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})