-- INVOICE REJECTION AND RLS POLICY CHECK
-- Run this to verify policies allow rejecting invoices

-- 1. Check current RLS policies on invoices table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual as policy_condition,
  with_check
FROM pg_policies
WHERE tablename = 'invoices'
ORDER BY policyname;

-- 2. Check your user's role
SELECT 
  id,
  email,
  user_type
FROM public.profiles 
WHERE id = auth.uid()
LIMIT 1;

-- 3. Test query - Try to see if you can UPDATE an invoice to status='reject'
-- This simulates what the code will do
SELECT 
  id,
  bill_number,
  company_id,
  status,
  rejection_reason
FROM public.invoices
WHERE status != 'reject'
LIMIT 1;

-- 4. Check for any invoices that are already rejected (to verify update works)
SELECT 
  COUNT(*) as total_rejected,
  COUNT(DISTINCT company_id) as companies_with_rejected,
  STRING_AGG(DISTINCT status, ', ') as other_statuses
FROM public.invoices
WHERE status = 'reject';

-- 5. Check invoice columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoices'
  AND column_name IN ('status', 'rejection_reason', 'reassigned_to_invoice_id')
ORDER BY column_name;

-- 6. RLS Policy Details - What can authenticated users do?
SELECT 
  tablename,
  policyname,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'invoices'
  AND policyname LIKE '%UPDATE%'
LIMIT 5;
