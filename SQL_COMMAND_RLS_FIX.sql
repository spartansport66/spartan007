-- Ensure RLS is enabled and policies allow authenticated users to read sales and product data.

-- 1. Enable RLS on tables (if not already enabled)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 2. Create/Update SELECT policy for 'products' table
-- This allows any authenticated user (including Gate Keeper) to read product details.
DROP POLICY IF EXISTS "Allow authenticated read access to products" ON public.products;
CREATE POLICY "Allow authenticated read access to products"
  ON public.products FOR SELECT
  TO authenticated
  USING (TRUE);

-- 3. Create/Update SELECT policy for 'sales' table
-- This allows any authenticated user (including Gate Keeper) to read sales records.
DROP POLICY IF EXISTS "Allow authenticated read access to sales" ON public.sales;
CREATE POLICY "Allow authenticated read access to sales"
  ON public.sales FOR SELECT
  TO authenticated
  USING (TRUE);