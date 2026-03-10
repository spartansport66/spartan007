-- MUST RUN THIS FIRST IN SUPABASE SQL EDITOR
-- Add quantity column to online_order_staging table

ALTER TABLE public.online_order_staging
ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Verify it was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'online_order_staging' AND column_name = 'quantity'
ORDER BY ordinal_position;
