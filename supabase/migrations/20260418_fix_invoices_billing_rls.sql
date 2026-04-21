-- Fix RLS policies for invoices table to allow billing users full access

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "billing_view_invoices" ON public.invoices;
DROP POLICY IF EXISTS "billing_insert_invoices" ON public.invoices;
DROP POLICY IF EXISTS "billing_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing users and admins can SELECT invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing users and admins can UPDATE invoices" ON public.invoices;

-- Create comprehensive SELECT policy for billing users and admins
CREATE POLICY "Billing users can view invoices" ON public.invoices
FOR SELECT
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Create comprehensive INSERT policy for billing users and admins
CREATE POLICY "Billing users can insert invoices" ON public.invoices
FOR INSERT
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

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

COMMENT ON POLICY "Billing users can view invoices" ON public.invoices IS 'Allows billing users and admins to view all invoices';
COMMENT ON POLICY "Billing users can insert invoices" ON public.invoices IS 'Allows billing users and admins to create new invoices';
COMMENT ON POLICY "Billing users can update invoices" ON public.invoices IS 'Allows billing users and admins to update invoices';
