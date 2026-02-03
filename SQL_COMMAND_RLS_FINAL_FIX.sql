-- This script provides a final, robust fix for the Row Level Security (RLS) policies.

-- 1. Drop the old policies and any previous versions of the function to ensure a clean slate.
DROP POLICY IF EXISTS "Enable read access for admins or own orders" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for admins or own payments" ON public.payments;
DROP FUNCTION IF EXISTS is_admin();

-- 2. Create a new, more reliable is_admin() function.
-- SECURITY DEFINER allows the function to run with the permissions of the user who created it,
-- giving it the necessary access to check the 'profiles' table without being blocked by other RLS policies.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- It returns true if the 'user_type' in the profiles table for the currently authenticated user is 'admin'.
  -- The query now explicitly checks for the existence of the row before checking the user_type to avoid errors.
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND user_type = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create the policy for the 'orders' table using the new function.
-- This policy is now simpler and more reliable.
CREATE POLICY "Enable read access for admins or own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_admin() OR (auth.uid() = user_id)
);

-- 4. Re-create the policy for the 'payments' table using the new function.
CREATE POLICY "Enable read access for admins or own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  is_admin() OR (auth.uid() IN (SELECT user_id FROM orders WHERE id = payments.order_id))
);