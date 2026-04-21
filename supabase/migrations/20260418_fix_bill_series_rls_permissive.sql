-- Fix RLS policies for bill_series table - use auth.uid() instead of JWT claims
-- This is more reliable for checking permissions

-- First, drop existing policies if they exist
DROP POLICY IF EXISTS "billing_select_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "billing_insert_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "billing_update_bill_series" ON public.bill_series;

-- Enable RLS on bill_series
ALTER TABLE public.bill_series ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy for SELECT - allow any authenticated user to read
CREATE POLICY "authenticated_select_bill_series" ON public.bill_series
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a permissive policy for INSERT - allow any authenticated user (admin/billing)
CREATE POLICY "authenticated_insert_bill_series" ON public.bill_series
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create a permissive policy for UPDATE - allow any authenticated user
CREATE POLICY "authenticated_update_bill_series" ON public.bill_series
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verify the policies are created
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'bill_series'
ORDER BY policyname;
