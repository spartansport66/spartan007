-- Complete fix for payments RLS policies
-- The get_dealer_ledger() function needs to read payments, so we need a SELECT policy

-- 1. Disable RLS temporarily to drop all policies cleanly
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 3. Drop all existing policies first (in case they exist)
DROP POLICY IF EXISTS "allow_authenticated_select_payments" ON public.payments;
DROP POLICY IF EXISTS "allow_authenticated_update_payments" ON public.payments;
DROP POLICY IF EXISTS "allow_authenticated_insert_payments" ON public.payments;
DROP POLICY IF EXISTS "allow_authenticated_delete_payments" ON public.payments;

-- 4. Create permissive SELECT policy for all authenticated users (SECURITY DEFINER function will use this)
CREATE POLICY "allow_authenticated_select_payments" ON public.payments
FOR SELECT
TO authenticated
USING (true);

-- 5. Create UPDATE policy for authenticated users
CREATE POLICY "allow_authenticated_update_payments" ON public.payments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Create INSERT policy for authenticated users
CREATE POLICY "allow_authenticated_insert_payments" ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 7. Create DELETE policy for authenticated users
CREATE POLICY "allow_authenticated_delete_payments" ON public.payments
FOR DELETE
TO authenticated
USING (true);

-- Verify: This query should now return payment records when called from the app
-- SELECT * FROM get_dealer_ledger('YOUR_DEALER_ID'::uuid, false);
