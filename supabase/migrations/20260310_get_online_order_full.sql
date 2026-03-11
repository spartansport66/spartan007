-- Create RPC to return online orders with items (product name, code, qty)
-- Returns JSONB array of order objects for given UUID[] of order ids
CREATE OR REPLACE FUNCTION public.get_online_order_full(order_ids uuid[])
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
  SELECT
    o.id as order_id,
    o.order_number,
    o.bill_no,
    o.dispatch_number,
    od.client_name,
    od.platform_order_number,
    od.raw_item_name,
    od.mapped_product_id,
    (
      CASE WHEN EXISTS (SELECT 1 FROM public.sales s WHERE s.order_id = o.id)
           THEN (
             SELECT jsonb_agg(jsonb_build_object('product_id', s.product_id, 'qty', s.quantity, 'product_name', p.name, 'product_code', p.code))
             FROM public.sales s
             LEFT JOIN public.products p ON p.id = s.product_id
             WHERE s.order_id = o.id
           )
           ELSE (
             SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', od.mapped_product_id, 'qty', 1, 'product_name', p2.name, 'product_code', p2.code)), '[]'::jsonb)
             FROM public.products p2
             WHERE p2.id = od.mapped_product_id
           )
    END
    )::jsonb as items
  FROM public.online_orders o
  LEFT JOIN public.online_order_details od ON od.order_id = o.id
  WHERE o.id = ANY(order_ids)
 ) t;

$$;

-- Grant execute to authenticated (optional, adjust as needed)
GRANT EXECUTE ON FUNCTION public.get_online_order_full(uuid[]) TO authenticated;
