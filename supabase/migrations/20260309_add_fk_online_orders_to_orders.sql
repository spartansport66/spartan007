-- Remove any orphaned mirror rows in `online_orders`
DELETE FROM public.online_orders o
WHERE NOT EXISTS (SELECT 1 FROM public.orders r WHERE r.id = o.id);

-- Add foreign key constraint from online_orders.id -> orders.id so deleting an order
-- cascades to the mirror row. Guarded to be idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'online_orders_order_fk') THEN
    EXECUTE 'ALTER TABLE public.online_orders ADD CONSTRAINT online_orders_order_fk FOREIGN KEY (id) REFERENCES public.orders(id) ON DELETE CASCADE';
  END IF;
END
$$;

-- Note: apply this migration on the target database where you control schema changes.
