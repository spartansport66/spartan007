-- This function checks if the currently authenticated user has the 'admin' role in the public.profiles table.
-- It's defined as SECURITY DEFINER to run with the permissions of the function owner, allowing it to query the profiles table securely.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- The function returns true if the user_type in the profiles table for the current user's ID is 'admin'.
  RETURN (
    SELECT user_type = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing SELECT policies on the 'orders' table to avoid conflicts before creating a new one.
DROP POLICY IF EXISTS "Enable read access for admins or own orders" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for admins" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for own orders" ON public.orders;

-- This new policy allows users to read from the 'orders' table if they are an admin (checked via is_admin())
-- OR if the order's user_id matches their own authenticated user ID.
CREATE POLICY "Enable read access for admins or own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  is_admin() OR (auth.uid() = user_id)
);

-- Drop existing SELECT policies on the 'payments' table to avoid conflicts.
DROP POLICY IF EXISTS "Enable read access for admins or own payments" ON public.payments;
DROP POLICY IF EXISTS "Enable read access for admins" ON public.payments;
DROP POLICY IF EXISTS "Enable read access for own payments" ON public.payments;

-- This new policy allows users to read from the 'payments' table if they are an admin
-- OR if the payment is linked to an order that they created.
-- This covers both admins needing to see all payments and salespersons needing to see payments for their orders.
CREATE POLICY "Enable read access for admins or own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  is_admin() OR (auth.uid() IN (SELECT user_id FROM orders WHERE id = payments.order_id))
);