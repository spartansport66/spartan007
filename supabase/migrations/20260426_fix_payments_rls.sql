-- Fix duplicate payments RLS policy creation and ensure authenticated access.
-- This migration drops any existing payments policies with the same names
-- and recreates the permissive payments policies required by the dashboard.

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select_payments" ON public.payments;
DROP POLICY IF EXISTS "allow_authenticated_update_payments" ON public.payments;
DROP POLICY IF EXISTS "allow_authenticated_insert_payments" ON public.payments;
DROP POLICY IF EXISTS "allow_authenticated_delete_payments" ON public.payments;

CREATE POLICY "allow_authenticated_select_payments" ON public.payments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_authenticated_update_payments" ON public.payments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "allow_authenticated_insert_payments" ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "allow_authenticated_delete_payments" ON public.payments
FOR DELETE
TO authenticated
USING (true);
