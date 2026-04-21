-- CHECK BILL NUMBER CONSISTENCY BETWEEN ORDERS AND INVOICES
-- Verify if bill numbers match in both tables

-- 1. Check the LATEST bill numbers in both tables
SELECT 
  'Latest in ORDERS' as source,
  o.order_number,
  o.bill_no,
  o.company_id,
  o.bill_date,
  'N/A' as invoice_status
FROM public.orders o
WHERE o.bill_no IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 5

UNION ALL

SELECT 
  'Latest in INVOICES',
  o.order_number,
  i.bill_number,
  i.company_id,
  i.bill_date,
  i.status
FROM public.invoices i
LEFT JOIN public.orders o ON i.order_id = o.id
WHERE i.bill_number IS NOT NULL
ORDER BY i.created_at DESC
LIMIT 5;

-- 2. Check for MISMATCHES - same order but different bill numbers
SELECT 
  o.order_number,
  o.id as order_id,
  o.bill_no as order_bill_number,
  i.bill_number as invoice_bill_number,
  o.company_id as order_company,
  i.company_id as invoice_company,
  CASE WHEN o.bill_no != i.bill_number THEN '❌ MISMATCH' ELSE '✓ MATCH' END as status
FROM public.orders o
JOIN public.invoices i ON o.id = i.order_id
WHERE o.bill_no IS NOT NULL 
  AND i.bill_number IS NOT NULL
ORDER BY o.created_at DESC
LIMIT 10;

-- 3. Count how many orders/invoices have S/26-27/1024
SELECT 
  'ORDERS table' as table_name,
  COUNT(*) as count,
  STRING_AGG(DISTINCT o.order_number::text, ', ') as order_numbers
FROM public.orders o
WHERE o.bill_no = 'S/26-27/1024'

UNION ALL

SELECT 
  'INVOICES table',
  COUNT(*),
  STRING_AGG(DISTINCT o.order_number::text, ', ')
FROM public.invoices i
LEFT JOIN public.orders o ON i.order_id = o.id
WHERE i.bill_number = 'S/26-27/1024';

-- 4. Check the bill_series current_sequence_number for S company
SELECT 
  bs.series_prefix,
  bs.series_separator,
  bs.current_sequence_number,
  c.name as company_name,
  fy.year_name
FROM public.bill_series bs
LEFT JOIN public.companies c ON bs.company_id = c.id
LEFT JOIN public.financial_years fy ON bs.financial_year_id = fy.id
WHERE bs.series_prefix LIKE 'S%'
ORDER BY bs.created_at DESC
LIMIT 5;
