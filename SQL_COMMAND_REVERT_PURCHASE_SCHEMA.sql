-- This script will revert the changes made for the purchase management feature.

-- 1. Drop the function that increments stock
DROP FUNCTION IF EXISTS public.increment_stock(uuid, integer);

-- 2. Drop the purchase_items table
-- It's important to drop this first due to foreign key constraints
DROP TABLE IF EXISTS public.purchase_items;

-- 3. Drop the purchases table
DROP TABLE IF EXISTS public.purchases;

-- 4. Drop the suppliers table
DROP TABLE IF EXISTS public.suppliers;