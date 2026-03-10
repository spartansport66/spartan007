-- Allow multiple items per platform order number in staging
-- drop unique constraint on platform_order_number and replace with composite index

ALTER TABLE public.online_order_staging
  DROP CONSTRAINT IF EXISTS online_order_staging_platform_order_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_online_order_staging_order_item
  ON public.online_order_staging (platform_order_number, flipkart_item_name);

-- keep a plain index on order number for lookups
CREATE INDEX IF NOT EXISTS idx_online_order_staging_ordernumber
  ON public.online_order_staging (platform_order_number);
