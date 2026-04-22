-- Diagnostic query to check HOD approved orders - MATCHES ApprovedHODOrdersCard logic
-- Run this to verify warehouse orders are being shown correctly

-- 1. Check total orders with hod_status = 'approved'
SELECT 
  COUNT(*) as total_approved_hod_orders,
  COUNT(CASE WHEN bill_no IS NOT NULL THEN 1 END) as with_bill_no,
  COUNT(CASE WHEN bill_no IS NULL THEN 1 END) as without_bill_no,
  COUNT(CASE WHEN dispatched = false THEN 1 END) as not_dispatched,
  COUNT(CASE WHEN dispatch_date IS NULL THEN 1 END) as no_dispatch_date
FROM public.orders
WHERE hod_status = 'approved';

-- 2. Check orders that meet ALL criteria for warehouse display
-- (hod_status = 'approved', dispatched = false, dispatch_date = null, bill_no = null)
-- This matches ApprovedHODOrdersCard exactly
SELECT 
  o.id,
  o.order_number,
  o.order_date,
  o.bill_no,
  o.hod_status,
  o.dispatched,
  o.dispatch_date,
  d.name as dealer_name,
  COUNT(s.id) as item_count,
  o.total_amount
FROM public.orders o
LEFT JOIN public.dealers d ON o.dealer_id = d.id
LEFT JOIN public.sales s ON o.id = s.order_id
WHERE o.dispatched = false
  AND o.dispatch_date IS NULL
  AND o.bill_no IS NULL
  AND o.hod_status = 'approved'
GROUP BY o.id, o.order_number, o.order_date, o.bill_no, o.hod_status, o.dispatched, o.dispatch_date, d.name, o.total_amount
ORDER BY o.order_date DESC;

-- 3. Check RLS policy effectiveness by verifying warehouse_keeper role exists
SELECT 
  id,
  email,
  user_type,
  created_at
FROM public.profiles
WHERE user_type = 'warehouse_keeper'
LIMIT 5;
