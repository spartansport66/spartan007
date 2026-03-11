-- Migration: drop foreign key constraint forcing online_orders.id -> orders.id
-- This allows `online_orders` to have independent IDs and be inserted without creating `orders` rows.
ALTER TABLE IF EXISTS public.online_orders DROP CONSTRAINT IF EXISTS online_orders_order_fk;

-- Optional: ensure no lingering triggers or dependencies expect the mirror; review app behavior after applying.
