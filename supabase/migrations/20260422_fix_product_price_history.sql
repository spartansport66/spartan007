-- Fix for Product Price History Issue
-- This migration ensures unit_price is always populated in sales records
-- So that changing a product price won't affect old orders

-- 1. Check for any sales records with NULL unit_price
SELECT COUNT(*) as sales_with_null_unit_price
FROM public.sales
WHERE unit_price IS NULL OR unit_price = 0;

-- 2. View affected sales records
SELECT 
  s.id,
  s.order_id,
  s.product_id,
  s.quantity,
  s.unit_price,
  s.total_price,
  p.dp as current_product_price,
  p.name
FROM public.sales s
LEFT JOIN public.products p ON s.product_id = p.id
WHERE (s.unit_price IS NULL OR s.unit_price = 0)
  AND s.total_price > 0
LIMIT 20;

-- 3. Update any sales records with NULL/0 unit_price based on total_price / quantity
UPDATE public.sales
SET unit_price = ROUND(total_price / NULLIF(quantity, 0), 2)
WHERE (unit_price IS NULL OR unit_price = 0)
  AND total_price > 0
  AND quantity > 0;

-- 4. Verify the fix
SELECT COUNT(*) as total_sales,
       COUNT(CASE WHEN unit_price > 0 THEN 1 END) as sales_with_unit_price,
       COUNT(CASE WHEN unit_price IS NULL OR unit_price = 0 THEN 1 END) as remaining_issues
FROM public.sales;
