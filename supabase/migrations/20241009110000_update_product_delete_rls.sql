-- Drop the existing policy that only allows admins to delete
DROP POLICY IF EXISTS "Admins can delete products if no sales" ON public.products;

-- Create a new policy that allows both admins and inventory managers to delete
CREATE POLICY "Admins and Inventory Managers can delete products if no sales"
ON public.products
FOR DELETE
TO authenticated
USING (
  (public.has_inventory_access()) AND
  (NOT (EXISTS (
    SELECT 1
    FROM public.sales
    WHERE sales.product_id = products.id
  )))
);