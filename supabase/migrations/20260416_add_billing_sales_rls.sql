-- Add RLS policy for billing users to manage sales records
-- This allows billing users to insert and update sales items when editing bills

CREATE POLICY "Billing users can insert sales for orders"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Billing users can update sales for orders"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Billing users can delete sales for orders"
ON public.sales
FOR DELETE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY "Billing users can insert sales for orders" ON public.sales IS 'Allows billing users and admins to add items when editing orders';
COMMENT ON POLICY "Billing users can update sales for orders" ON public.sales IS 'Allows billing users and admins to modify items when editing orders';
COMMENT ON POLICY "Billing users can delete sales for orders" ON public.sales IS 'Allows billing users and admins to remove items when editing orders';
