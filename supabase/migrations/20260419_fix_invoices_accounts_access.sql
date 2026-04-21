-- Fix RLS policy on invoices to allow accounts users to view invoices
-- This is needed for the print bill feature to calculate correct net ledger balance

-- Drop the restrictive billing-only policy
DROP POLICY IF EXISTS "Billing users can view invoices" ON public.invoices;

-- Create a new policy that allows billing, admin, and accounts users to view invoices
CREATE POLICY "Billing and accounts users can view invoices" ON public.invoices
FOR SELECT
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'accounts')
);

-- Create a new INSERT policy
CREATE POLICY "Billing and accounts users can insert invoices" ON public.invoices
FOR INSERT
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'accounts')
);

-- Create a new UPDATE policy
CREATE POLICY "Billing and accounts users can update invoices" ON public.invoices
FOR UPDATE
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'accounts')
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'accounts')
);

COMMENT ON POLICY "Billing and accounts users can view invoices" ON public.invoices IS 'Allows billing, accounts, and admin users to view all invoices';
COMMENT ON POLICY "Billing and accounts users can insert invoices" ON public.invoices IS 'Allows billing, accounts, and admin users to create invoices';
COMMENT ON POLICY "Billing and accounts users can update invoices" ON public.invoices IS 'Allows billing, accounts, and admin users to update invoices';
