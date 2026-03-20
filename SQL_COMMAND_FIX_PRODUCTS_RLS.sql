-- FIX RLS POLICY FOR PRODUCTS TABLE
-- Allow both authenticated and unauthenticated users to read products

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Allow authenticated users to read products" ON public.products;

-- Create new policy that allows PUBLIC (unauthenticated) access
CREATE POLICY "Allow all users to read products"
ON public.products
FOR SELECT
USING (true);
