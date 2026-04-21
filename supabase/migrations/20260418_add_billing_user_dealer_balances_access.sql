-- Add 'billing' user role access to dealer_balances table for opening balance display

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Allow admin and manager to view all dealer balances" ON public.dealer_balances;

-- Create a new policy allowing 'admin', 'manager', and 'billing' to view all dealer balances
CREATE POLICY "Allow admin, manager, and billing to view all dealer balances"
ON public.dealer_balances
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
    AND public.profiles.user_type IN ('admin', 'manager', 'billing')
  )
);
