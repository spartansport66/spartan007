-- Query to check invoices for the Demo dealer and their status
SELECT 
  id,
  bill_number,
  status,
  grand_total,
  bill_date,
  dealer_id
FROM public.invoices
WHERE dealer_id = 'bbae747b-c708-4c79-ba43-c9469f114dea'
ORDER BY bill_date DESC;

-- Also check all unique status values in invoices table
SELECT DISTINCT status, COUNT(*) as count
FROM public.invoices
GROUP BY status;

-- Check if there are orders that might need to be included instead
SELECT 
  id,
  order_number,
  bill_no,
  total_amount,
  dispatch_date,
  dealer_id
FROM public.orders
WHERE dealer_id = 'bbae747b-c708-4c79-ba43-c9469f114dea'
  AND dispatched = true
ORDER BY dispatch_date DESC;
