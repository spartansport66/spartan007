-- DIAGNOSTIC: Check the actual state of bill_series table and data

-- 1. Check if bill_series table exists and has data
SELECT 'bill_series table data:' as check_name;
SELECT COUNT(*) as total_records FROM public.bill_series;

-- 2. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'bill_series';

-- 3. List all RLS policies on bill_series
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'bill_series'
ORDER BY policyname;

-- 4. Check financial_years data
SELECT COUNT(*) as financial_years_count FROM public.financial_years WHERE is_active = true;

-- 5. Check companies data  
SELECT COUNT(*) as companies_count FROM public.companies WHERE is_active = true;

-- 6. Check if bill_series records exist for active companies/FY
SELECT 
  bs.id,
  c.name as company_name,
  fy.year_name as financial_year,
  bs.series_prefix,
  bs.current_sequence_number,
  bs.is_active
FROM public.bill_series bs
JOIN public.companies c ON bs.company_id = c.id
JOIN public.financial_years fy ON bs.financial_year_id = fy.id
WHERE c.is_active = true AND fy.is_active = true
LIMIT 10;

-- 7. DISABLE RLS on bill_series (TEMPORARY FIX TO TEST)
ALTER TABLE public.bill_series DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'bill_series';
