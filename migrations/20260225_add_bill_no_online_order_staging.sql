-- Add bill_no column to online_order_staging
BEGIN;

ALTER TABLE public.online_order_staging
  ADD COLUMN IF NOT EXISTS bill_no text;

COMMIT;
