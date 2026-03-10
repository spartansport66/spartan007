-- Allow admins and online_orders managers to SELECT from sales for online orders
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers and admins can select sales for online orders" ON public.sales
FOR SELECT TO authenticated
USING (
  (public.is_admin()) OR (
    public.is_online_orders_manager() AND (
      EXISTS (
        SELECT 1 FROM public.orders o
        JOIN public.dealers d ON o.dealer_id = d.id
        WHERE o.id = sales.order_id AND d.name = 'Online Order'
      )
    )
  )
);

-- Note: After applying this migration, the dashboard's fallback that reads from `sales` will be able to fetch product names for online orders when the user is an admin or an online_orders manager.
