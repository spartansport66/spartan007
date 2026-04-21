-- Check for DUPLICATE bill numbers across ALL companies
SELECT 
  bill_number,
  COUNT(*) as duplicate_count,
  COUNT(DISTINCT company_id) as company_count,
  COUNT(DISTINCT order_id) as order_count,
  STRING_AGG(DISTINCT company_id::text, ', ') as companies,
  STRING_AGG(DISTINCT order_id::text, ', ') as order_ids
FROM public.invoices
WHERE bill_number IS NOT NULL
GROUP BY bill_number
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Check bill_series current_sequence_number for ALL companies
SELECT 
  bs.id as bill_series_id,
  c.name as company_name,
  fy.financial_year,
  bs.series_prefix,
  bs.series_separator,
  bs.current_sequence_number,
  COUNT(i.id) as total_bills_generated,
  MAX(i.created_at) as last_bill_date
FROM public.bill_series bs
JOIN public.companies c ON bs.company_id = c.id
JOIN public.financial_years fy ON bs.financial_year_id = fy.id
LEFT JOIN public.invoices i ON bs.id = i.bill_series_id
GROUP BY bs.id, c.name, fy.financial_year, bs.series_prefix, bs.series_separator, bs.current_sequence_number
ORDER BY c.name, fy.financial_year;

-- Find orders and invoices with same bill number
SELECT 
  o.order_number,
  o.bill_no as orders_bill_no,
  i.bill_number as invoice_bill_number,
  (CASE WHEN o.bill_no = i.bill_number THEN '✅ MATCH' ELSE '❌ MISMATCH' END) as match_status,
  i.company_id,
  COUNT(*) OVER (PARTITION BY i.bill_number) as bill_number_count
FROM public.orders o
LEFT JOIN public.invoices i ON o.id = i.order_id
WHERE o.bill_no IS NOT NULL AND i.bill_number IS NOT NULL
ORDER BY i.bill_number, o.order_number;
