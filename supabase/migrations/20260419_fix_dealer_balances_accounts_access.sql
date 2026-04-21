-- Fix RLS policy on dealer_balances to allow accounts users to view opening balance
-- This is needed for the print bill feature to calculate correct net ledger balance

-- Drop the existing billing-only policy
DROP POLICY IF EXISTS "Allow admin, manager, and billing to view all dealer balances" ON public.dealer_balances;

-- Create a new policy that allows billing, admin, accounts, and manager users to view dealer balances
CREATE POLICY "Allow admin, manager, billing, and accounts to view dealer balances"
ON public.dealer_balances
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
    AND public.profiles.user_type IN ('admin', 'manager', 'billing', 'accounts')
  )
);

COMMENT ON POLICY "Allow admin, manager, billing, and accounts to view dealer balances" ON public.dealer_balances IS 'Allows admin, manager, billing, and accounts users to view dealer balance information including opening balance';
