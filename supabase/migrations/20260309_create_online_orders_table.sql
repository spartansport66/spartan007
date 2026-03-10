-- Create sequence for online orders starting at 1000
CREATE SEQUENCE IF NOT EXISTS public.online_orders_seq START 1000;

-- RPC to fetch next sequence value
CREATE OR REPLACE FUNCTION public.get_next_online_order_seq()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT nextval('public.online_orders_seq');
$$;

-- Create online_orders table (simple subset of orders used for online-extracted orders)
CREATE TABLE IF NOT EXISTS public.online_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT,
  order_sequence BIGINT,
  dealer_id UUID,
  user_id UUID,
  total_amount NUMERIC DEFAULT 0,
  status TEXT,
  payment_status TEXT,
  order_date TIMESTAMPTZ,
  dispatched BOOLEAN DEFAULT FALSE,
  dispatch_date TIMESTAMPTZ,
  dispatch_number TEXT,
  bill_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lookups
CREATE INDEX IF NOT EXISTS idx_online_orders_order_sequence ON public.online_orders(order_sequence);
CREATE INDEX IF NOT EXISTS idx_online_orders_dispatch_number ON public.online_orders(dispatch_number);
CREATE INDEX IF NOT EXISTS idx_online_orders_dealer_id ON public.online_orders(dealer_id);
