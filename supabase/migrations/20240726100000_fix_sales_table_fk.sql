-- This migration adds the foreign key constraint from the sales table
-- to the orders table. This is crucial for Supabase's PostgREST layer to
-- understand the relationship and allow for nested queries.
-- The ON DELETE CASCADE ensures that if an order is deleted, all its
-- associated sales items are also automatically deleted, preventing orphaned rows.

ALTER TABLE public.sales
ADD CONSTRAINT sales_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES public.orders (id)
ON DELETE CASCADE;