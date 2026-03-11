// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { orderIds } = await req.json();
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return new Response(JSON.stringify({ error: 'orderIds array is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create a Supabase client with the service role key to bypass RLS
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch online order detail rows
    const { data: detailsData, error: detailsError } = await supabaseAdmin
      .from('online_order_details')
      .select('order_id, client_name, platform_order_number, address, contact_no, raw_item_name, mapped_product_id')
      .in('order_id', orderIds);

    if (detailsError) throw detailsError;

    // Fetch sales rows and join products to get item names and quantities
    const { data: salesData, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('order_id, product_id, quantity, products(id, name, code)')
      .in('order_id', orderIds);

    if (salesError) throw salesError;

    // Group sales by order_id
    const salesByOrder = new Map();
    (salesData || []).forEach((s: any) => {
      const list = salesByOrder.get(s.order_id) || [];
      list.push({ product_id: s.product_id, qty: s.quantity, product_name: s.products?.name || null, product_code: s.products?.code || null });
      salesByOrder.set(s.order_id, list);
    });

    // If sales items are missing but a mapped_product_id exists, fetch those products
    const ordersWithNoSales = (detailsData || []).filter((d: any) => !(salesByOrder.get(d.order_id) || []).length && d.mapped_product_id).map((d: any) => d.mapped_product_id);
    let mappedProductsMap = new Map();
    if (ordersWithNoSales.length > 0) {
      const { data: mappedProducts, error: prodErr } = await supabaseAdmin.from('products').select('id, name, code').in('id', ordersWithNoSales);
      if (!prodErr && mappedProducts) {
        mappedProducts.forEach((p: any) => mappedProductsMap.set(p.id, p));
      }
    }

    const result = (detailsData || []).map((d: any) => {
      let items = salesByOrder.get(d.order_id) || [];
      if ((!items || items.length === 0) && d.mapped_product_id) {
        const mp = mappedProductsMap.get(d.mapped_product_id);
        if (mp) {
          items = [{ product_id: d.mapped_product_id, qty: 1, product_name: mp.name || null, product_code: mp.code || null }];
        }
      }
      return {
        order_id: d.order_id,
        client_name: d.client_name,
        platform_order_number: d.platform_order_number,
        address: d.address,
        contact_no: d.contact_no,
        raw_item_name: d.raw_item_name,
        mapped_product_id: d.mapped_product_id,
        items,
      };
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-online-order-details] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})