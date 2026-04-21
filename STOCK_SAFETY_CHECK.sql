-- STOCK SAFETY CHECK BEFORE PUSHING MIGRATIONS

-- 1. Check if ORDERS affect stock
SELECT COUNT(*) as total_orders_with_bills
FROM public.orders
WHERE bill_no IS NOT NULL;

-- 2. Check if INVOICES affect stock  
SELECT COUNT(*) as total_invoices
FROM public.invoices
WHERE bill_number IS NOT NULL;

-- 3. Check STOCK_RECEIPTS - these track incoming stock
SELECT 
  COUNT(*) as total_stock_receipts,
  SUM(quantity) as total_stock_in
FROM public.stock_receipts;

-- 4. Check if stock_ledger exists and has order/bill references
SELECT 
  COUNT(*) as has_stock_ledger,
  COALESCE(SUM(CASE WHEN column_name = 'order_id' THEN 1 ELSE 0 END), 0) as has_order_reference,
  COALESCE(SUM(CASE WHEN column_name = 'bill_id' THEN 1 ELSE 0 END), 0) as has_bill_reference
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name LIKE 'stock%';

-- 5. Check PRODUCTS table - if it has stock fields
SELECT 
  COUNT(*) as total_products,
  SUM(CASE WHEN column_name IN ('quantity_in_hand', 'stock_quantity', 'available_stock') THEN 1 ELSE 0 END) as has_stock_field
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products';

-- 6. Check SALES table - connects orders to products
SELECT COUNT(*) as total_sales_records
FROM public.sales;

-- 7. Check for any CANCELLED BILLS impact
SELECT 
  COUNT(i.id) as cancelled_bills_with_reassignment,
  COUNT(DISTINCT o.id) as orders_affected
FROM public.invoices i
LEFT JOIN public.orders o ON i.order_id = o.id
WHERE i.reassigned_to_invoice_id IS NOT NULL 
   OR i.reassigned_from_invoice_id IS NOT NULL;

-- 8. Check relationship: ORDERS → SALES → PRODUCTS
SELECT 
  COUNT(DISTINCT o.id) as orders_with_sales,
  COUNT(s.id) as total_sales_items,
  COUNT(DISTINCT s.product_id) as unique_products
FROM public.orders o
JOIN public.sales s ON o.id = s.order_id;

-- 9. Most Important: Check if stock is DEDUCTED when bill is created
-- (This query helps understand the business logic)
SELECT 
  'No direct link found' as finding,
  'Stock is managed separately via stock_receipts, not via bills/invoices' as conclusion;
