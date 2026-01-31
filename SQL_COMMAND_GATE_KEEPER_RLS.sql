-- 1. Ensure RLS is enabled on the 'orders' table (if not already)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 2. Create a function to check if the current user is a gate_keeper
-- This function is necessary because RLS policies cannot directly query the 'profiles' table for user_type.
CREATE OR REPLACE FUNCTION is_gate_keeper()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'gate_keeper'
  );
$$;

-- 3. Create the RLS policy on the orders table
-- This policy allows authenticated users (Gate Keepers) to update orders
-- ONLY if they are a gate_keeper AND the order is already marked as dispatched (dispatched = TRUE AND bill_no IS NOT NULL).
-- The policy relies on the client code only sending the gate_pass_dispatch_time column.
DROP POLICY IF EXISTS "Gate Keepers can authorize final dispatch" ON public.orders;
CREATE POLICY "Gate Keepers can authorize final dispatch"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    is_gate_keeper() AND dispatched = TRUE AND bill_no IS NOT NULL
  )
  WITH CHECK (
    is_gate_keeper() AND dispatched = TRUE AND bill_no IS NOT NULL
  );