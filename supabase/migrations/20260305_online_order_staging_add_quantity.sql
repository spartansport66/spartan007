-- Add quantity column to staging to support aggregated items per order
ALTER TABLE public.online_order_staging
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Backfill any existing rows with quantity = 1
UPDATE public.online_order_staging SET quantity = 1 WHERE quantity IS NULL;
