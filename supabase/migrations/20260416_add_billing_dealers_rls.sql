-- Add RLS policy for billing user type to read dealers
-- This allows billing users to view all dealer information when creating/editing bills

CREATE POLICY "Allow billing users to read all dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

COMMENT ON POLICY "Allow billing users to read all dealers" ON public.dealers IS 'Allows billing users and admins to view all dealer information for bill generation';
