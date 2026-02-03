-- This script provides a more robust fix for Row Level Security (RLS) by embedding the admin check directly into the policies,
-- which is more reliable than using a separate helper function.

-- 1. Drop the problematic helper function as it's no longer needed.
DROP FUNCTION IF EXISTS is_admin();

-- 2. Drop the old, non-functional policies on the 'orders' table to avoid conflicts.
DROP POLICY IF EXISTS "Enable read access for admins or own orders" ON public.orders;

-- 3. Create a new, more direct policy for the 'orders' table.
-- This policy allows a user to read an order if:
-- a) Their user_type in the 'profiles' table is 'admin'.
-- b) The order's 'user_id' matches their own ID.
CREATE POLICY "Enable read access for admins or own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR
  (auth.uid() = user_id)
);

-- 4. Drop the old, non-functional policies on the 'payments' table.
DROP POLICY IF EXISTS "Enable read access for admins or own payments" ON public.payments;

-- 5. Create a new, more direct policy for the 'payments' table.
-- This policy allows a user to read a payment if:
-- a) Their user_type in the 'profiles' table is 'admin'.
-- b) The payment is linked to an order that they created.
-- c) The payment is a general payment (no order_id) and is linked directly to their dealer_id (this part is for future use cases, but good to have).
CREATE POLICY "Enable read access for admins or own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
  OR
  (auth.uid() IN (SELECT user_id FROM orders WHERE id = payments.order_id))
  OR
  (payments.order_id IS NULL AND auth.uid() = payments.dealer_id) -- For general payments, if a user is also a dealer.
);