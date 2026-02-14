-- Drop the old, more restrictive insert policy
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;

-- Create a new policy that allows both admins and inventory managers to insert products
CREATE POLICY "Admins and Inventory Managers can insert products" ON public.products
FOR INSERT TO authenticated
WITH CHECK (public.has_inventory_access());

-- Add a corresponding policy for updating products, which was missing
DROP POLICY IF EXISTS "Admins and Inventory Managers can update products" ON public.products;
CREATE POLICY "Admins and Inventory Managers can update products" ON public.products
FOR UPDATE TO authenticated
USING (public.has_inventory_access());