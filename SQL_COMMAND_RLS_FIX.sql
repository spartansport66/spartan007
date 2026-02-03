-- This script provides the definitive fix for Row Level Security (RLS) by including the 'super_admin' role in the access policies.

-- 1. Drop the old policy on the 'orders' table.
DROP POLICY IF EXISTS "Enable read access for admins or own orders" ON public.orders;

-- 2. Create the corrected policy for the 'orders' table.
-- This policy allows a user to read an order if:
-- a) Their user_type is 'admin' OR 'super_admin'.
-- b) The order's 'user_id' matches their own ID.
CREATE POLICY "Enable read access for admins or own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  OR
  (auth.uid() = user_id)
);

-- 3. Drop the old policy on the 'payments' table.
DROP POLICY IF EXISTS "Enable read access for admins or own payments" ON public.payments;

-- 4. Create the corrected policy for the 'payments' table.
-- This policy allows a user to read a payment if:
-- a) Their user_type is 'admin' OR 'super_admin'.
-- b) The payment is linked to an order that they created.
CREATE POLICY "Enable read access for admins or own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  OR
  (auth.uid() IN (SELECT user_id FROM orders WHERE id = payments.order_id))
);