-- supabase/migrations/20240725123456_add_fk_to_order_items.sql

-- This migration adds the foreign key constraint from the order_items table
-- to the orders table. This is crucial for Supabase's PostgREST layer to
-- understand the relationship and allow for nested queries.
-- The ON DELETE CASCADE ensures that if an order is deleted, all its
-- associated items are also automatically deleted, preventing orphaned rows.

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES public.orders (id)
ON DELETE CASCADE;