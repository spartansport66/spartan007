-- 1. Create a helper function to identify 'online_orders' user type
CREATE OR REPLACE FUNCTION public.is_online_orders_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'online_orders'
  );
$$;

-- 2. Grant permissions on 'orders' table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers can view online orders" ON public.orders
FOR SELECT TO authenticated USING (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.dealers d WHERE d.id = orders.dealer_id AND d.name = 'Online Order'
  )))
);

CREATE POLICY "Online orders managers can update online orders" ON public.orders
FOR UPDATE TO authenticated USING (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.dealers d WHERE d.id = orders.dealer_id AND d.name = 'Online Order'
  )))
) WITH CHECK (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.dealers d WHERE d.id = orders.dealer_id AND d.name = 'Online Order'
  )))
);

CREATE POLICY "Online orders managers can delete online orders" ON public.orders
FOR DELETE TO authenticated USING (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.dealers d WHERE d.id = orders.dealer_id AND d.name = 'Online Order'
  )))
);

-- 3. Grant permissions on 'online_order_details' table
ALTER TABLE public.online_order_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers can manage online order details" ON public.online_order_details
FOR ALL TO authenticated USING (is_online_orders_manager())
WITH CHECK (is_online_orders_manager());

-- 4. Grant permissions on 'sales' table
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers can insert sales for online orders" ON public.sales
FOR INSERT TO authenticated WITH CHECK (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.dealers d ON o.dealer_id = d.id
    WHERE o.id = sales.order_id AND d.name = 'Online Order'
  )))
);

CREATE POLICY "Online orders managers can delete sales for online orders" ON public.sales
FOR DELETE TO authenticated USING (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.dealers d ON o.dealer_id = d.id
    WHERE o.id = sales.order_id AND d.name = 'Online Order'
  )))
);

-- 5. Grant permissions on 'payments' table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers can delete payments for online orders" ON public.payments
FOR DELETE TO authenticated USING (
  (is_online_orders_manager() AND (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.dealers d ON o.dealer_id = d.id
    WHERE o.id = payments.order_id AND d.name = 'Online Order'
  )))
);

-- 6. Grant permissions on 'dealers' table
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers can read the Online Order dealer" ON public.dealers
FOR SELECT TO authenticated USING (
  (is_online_orders_manager() AND name = 'Online Order')
);

-- 7. Grant permissions on 'profiles' table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Online orders managers can view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (is_online_orders_manager());