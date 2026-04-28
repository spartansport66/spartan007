-- Allow account users to mark orders as bill approved
-- This policy permits only the bill_approved flag to be updated by accounts users.

CREATE POLICY "Accounts can update order bill approval flag" ON public.orders
FOR UPDATE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'accounts'
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'accounts'
  AND bill_approved = true
);

COMMENT ON POLICY "Accounts can update order bill approval flag" ON public.orders IS 'Allows accounts users to set bill_approved on orders';
