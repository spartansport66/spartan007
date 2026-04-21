-- Ensure RLS policy allows updating company_id on invoices

-- Drop and recreate the UPDATE policy to be explicit about company_id
DROP POLICY IF EXISTS "Billing users can update invoices" ON public.invoices;

-- Create comprehensive UPDATE policy for billing users and admins
CREATE POLICY "Billing users can update invoices" ON public.invoices
FOR UPDATE
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Also ensure SELECT works for fetching the current state
DROP POLICY IF EXISTS "Billing users can view invoices" ON public.invoices;

CREATE POLICY "Billing users can view invoices" ON public.invoices
FOR SELECT
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY "Billing users can update invoices" ON public.invoices IS 'Allows billing users and admins to update any invoice field including company_id';
COMMENT ON POLICY "Billing users can view invoices" ON public.invoices IS 'Allows billing users and admins to view all invoices';
