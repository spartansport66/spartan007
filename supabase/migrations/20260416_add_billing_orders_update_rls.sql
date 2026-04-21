-- Add RLS policy for billing users to update orders table
-- This allows billing users to update order fields including freight_charges

CREATE POLICY "Billing users can update orders"
ON public.orders
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

COMMENT ON POLICY "Billing users can update orders" ON public.orders IS 'Allows billing users and admins to update order details including freight charges';
