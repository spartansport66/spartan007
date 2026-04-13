-- Add RLS policy for accounts user type to update dealers table
-- This allows accounts users to approve payments and update dealer credit_limit and opening_balance

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

-- Policy: Allow accounts users to view all dealers
CREATE POLICY IF NOT EXISTS "Allow accounts users to read all dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'accounts'
);

-- Policy: Allow accounts users to update dealers (for credit_limit and opening_balance)
CREATE POLICY IF NOT EXISTS "Allow accounts users to update dealer credit and balance"
ON public.dealers
FOR UPDATE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'accounts'
) WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'accounts'
);
