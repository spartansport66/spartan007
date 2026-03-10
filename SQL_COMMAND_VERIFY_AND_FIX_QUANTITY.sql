-- Verify quantity column exists and update existing records
-- Run this to check if quantity column was added

-- Step 1: Check if quantity column exists
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'online_order_staging' AND column_name = 'quantity';

-- If the column doesn't exist, add it with this command:
-- ALTER TABLE public.online_order_staging ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Step 2: If you already have data and want to recalculate quantities from amounts
-- This assumes: if an item appears multiple times with same product name + order number, 
-- and the total amount is X, we can infer quantity from historical data
-- For now, all existing rows will have quantity=1 (the default)

-- Step 3: If you extracted 2 items and saved with mapped product, 
-- but need the quantity updated, you can manually update:
UPDATE public.online_order_staging
SET quantity = 2
WHERE platform_order_number = 'OD4369544954857I8I00' 
AND flipkart_item_name = 'ECO CRICKET BATTING LEGGUARD'
AND quantity = 1;

-- Step 4: Verify the update
SELECT platform_order_number, flipkart_item_name, amount, quantity
FROM public.online_order_staging
WHERE platform_order_number = 'OD4369544954857I8I00';

-- Clean solution: Re-extract and remap
-- 1. Extract PDF again
-- 2. Map the product - it will now save with correct quantity from merged items
-- The new extraction will save quantity=2 automatically
