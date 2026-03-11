-- Migration: change online_order_details.order_id FK to reference online_orders(id)
-- Drop existing FK to orders and create FK to online_orders so online_order_details
-- can reference rows created only in `online_orders`.
ALTER TABLE IF EXISTS public.online_order_details DROP CONSTRAINT IF EXISTS online_order_details_order_id_fkey;

ALTER TABLE IF EXISTS public.online_order_details
  ADD CONSTRAINT online_order_details_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.online_orders(id) ON DELETE CASCADE;

-- Note: run as a DB admin. Verify related application code that expects order_id -> orders.id.
