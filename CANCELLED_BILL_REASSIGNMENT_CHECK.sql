-- CANCELLED BILL REASSIGNMENT IMPACT CHECK
-- This checks what happens when we create a NEW invoice on company change

-- 1. Current cancelled bills that might be reassigned
SELECT 
  COUNT(i.id) as cancelled_bills_in_system,
  COUNT(DISTINCT o.id) as unique_orders,
  COUNT(DISTINCT i.company_id) as companies_involved,
  STRING_AGG(DISTINCT c.name, ', ') as company_names
FROM public.invoices i
LEFT JOIN public.orders o ON i.order_id = o.id
LEFT JOIN public.companies c ON i.company_id = c.id
WHERE i.bill_number IS NOT NULL;

-- 2. Check for orders with MULTIPLE invoices (will increase after migration)
SELECT 
  o.order_number,
  o.id as order_id,
  COUNT(i.id) as invoice_count,
  STRING_AGG(i.bill_number, ' → ') as bill_numbers
FROM public.orders o
JOIN public.invoices i ON o.id = i.order_id
GROUP BY o.id, o.order_number
HAVING COUNT(i.id) > 1
ORDER BY invoice_count DESC;

-- 3. Check if NEW invoice creation will cause issues with sales items
-- (Each invoice uses same order_id, so items are shared - this is OK)
SELECT 
  o.id as order_id,
  o.order_number,
  COUNT(DISTINCT i.id) as invoice_count,
  COUNT(DISTINCT s.id) as total_sales_items,
  'Same sales items will be used by multiple invoices (SAFE - by design)' as note
FROM public.orders o
JOIN public.invoices i ON o.id = i.order_id
JOIN public.sales s ON o.id = s.order_id
GROUP BY o.id, o.order_number
HAVING COUNT(DISTINCT i.id) > 1;

-- 4. Check current invoice columns (before reassignment tracking added)
SELECT 
  COUNT(*) as existing_columns
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'invoices';

-- 5. Check payment records - will they be affected?
SELECT 
  COUNT(DISTINCT p.id) as total_payments,
  COUNT(DISTINCT p.order_id) as orders_with_payments
FROM public.payments p
WHERE p.order_id IN (
  SELECT DISTINCT order_id FROM public.invoices WHERE bill_number IS NOT NULL
);

-- 6. KEY CHECK: Stock Impact
-- Are there any triggers on orders/invoices that affect stock?
SELECT 
  COUNT(*) as active_triggers,
  STRING_AGG(trigger_name, ', ') as trigger_names
FROM information_schema.triggers
WHERE event_object_schema = 'public' 
  AND event_object_table IN ('orders', 'invoices');

