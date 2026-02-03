-- Update RLS policy on dealer_balances to allow 'manager' role to SELECT data.

-- Assuming RLS is enabled on dealer_balances. If not, run:
-- ALTER TABLE public.dealer_balances ENABLE ROW LEVEL SECURITY;

-- Drop any existing broad SELECT policy that might conflict (if we don't know its name)
-- Note: This is a generic name, adjust if your existing policy has a specific name.
DROP POLICY IF EXISTS "Allow admin to view all dealer balances" ON public.dealer_balances;

-- Create a new policy allowing 'admin' and 'manager' to view all dealer balances
CREATE POLICY "Allow admin and manager to view all dealer balances"
ON public.dealer_balances
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE public.profiles.id = auth.uid()
    AND public.profiles.user_type IN ('admin', 'manager')
  )
);