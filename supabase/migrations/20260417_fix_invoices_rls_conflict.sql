-- Fix RLS policies on invoices table - Testing update functionality
-- Temporarily allow all authenticated users to UPDATE while we debug

-- Drop ALL old policies
DROP POLICY IF EXISTS "billing_view_invoices" ON public.invoices;
DROP POLICY IF EXISTS "billing_insert_invoices" ON public.invoices;
DROP POLICY IF EXISTS "billing_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "All authenticated users can SELECT invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing users and admins can UPDATE invoices" ON public.invoices;
DROP POLICY IF EXISTS "users_select_invoices" ON public.invoices;
DROP POLICY IF EXISTS "users_update_invoices" ON public.invoices;

-- Simple approach: Allow all authenticated users to SELECT
CREATE POLICY "users_select_invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (true);

-- TEMPORARILY: Allow all authenticated users to UPDATE (for testing)
-- We'll restrict this after we verify the update mechanism works
CREATE POLICY "users_update_invoices"
ON public.invoices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT SELECT, UPDATE ON public.invoices TO authenticated;
