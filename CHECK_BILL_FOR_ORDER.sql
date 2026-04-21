-- CHECK BILL NUMBER FOR SPECIFIC ORDER (FIXED)
-- Order ID: d0c3c5a8-9476-4aa6-8484-d1f90326804c

-- First check what columns exist in orders table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- 1. Check ORDERS table
SELECT 
  'ORDERS table' as source,
  o.id as order_id,
  o.order_number,
  o.bill_no,
  o.bill_date,
  o.created_at,
  o.updated_at
FROM public.orders o
WHERE o.id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c';

-- 2. Check INVOICES table for this order
SELECT 
  'INVOICES table' as source,
  i.id as invoice_id,
  o.id as order_id,
  o.order_number,
  i.bill_number,
  i.bill_date,
  i.status,
  i.company_id,
  c.name as company_name,
  i.created_at,
  i.updated_at
FROM public.invoices i
LEFT JOIN public.orders o ON i.order_id = o.id
LEFT JOIN public.companies c ON i.company_id = c.id
WHERE o.id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c'
ORDER BY i.created_at DESC;

-- 3. COMPARISON - Summary
SELECT 
  CASE 
    WHEN (SELECT o.bill_no FROM public.orders o WHERE o.id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c') 
         = (SELECT i.bill_number FROM public.invoices i 
            LEFT JOIN public.orders o ON i.order_id = o.id 
            WHERE o.id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c' 
            ORDER BY i.created_at DESC LIMIT 1)
    THEN '✅ MATCH' 
    ELSE '❌ MISMATCH' 
  END as status,
  (SELECT o.bill_no FROM public.orders o WHERE o.id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c') as orders_bill_no,
  (SELECT i.bill_number FROM public.invoices i 
   LEFT JOIN public.orders o ON i.order_id = o.id 
   WHERE o.id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c' 
   ORDER BY i.created_at DESC LIMIT 1) as latest_invoices_bill_number;
