-- Proper RLS Policies for bill_series table
-- This allows billing users to access bill_series while maintaining security

-- Enable RLS on bill_series
ALTER TABLE public.bill_series ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "authenticated_select_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "authenticated_insert_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "authenticated_update_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "billing_select_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "billing_insert_bill_series" ON public.bill_series;
DROP POLICY IF EXISTS "billing_update_bill_series" ON public.bill_series;

-- Policy 1: Allow billing users to SELECT bill_series
CREATE POLICY "billing_select_bill_series" ON public.bill_series
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.user_type IN ('billing', 'admin', 'sales_person')
    )
  );

-- Policy 2: Allow billing users to INSERT bill_series
CREATE POLICY "billing_insert_bill_series" ON public.bill_series
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.user_type IN ('billing', 'admin')
    )
  );

-- Policy 3: Allow billing users to UPDATE bill_series
CREATE POLICY "billing_update_bill_series" ON public.bill_series
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.user_type IN ('billing', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.user_type IN ('billing', 'admin')
    )
  );

-- Verify policies were created
SELECT policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'bill_series'
ORDER BY policyname;

-- Test that RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'bill_series';
