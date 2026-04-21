-- Search for the bill with ID: d0c3c5a8-9476-4aa6-8484-d1f90326804c

-- Check in SPARTAN table
SELECT 'spartan' as table_name, id, bill_number, bill_date, order_id, dealer_id, company_id, status
FROM public.spartan
WHERE id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c'
LIMIT 1;

-- Check in FIGHTOR table
SELECT 'fightor' as table_name, id, bill_number, bill_date, order_id, dealer_id, company_id, status
FROM public.fightor
WHERE id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c'
LIMIT 1;

-- Check in ORDERS table
SELECT 'orders' as table_name, id, order_number, bill_no, total_amount
FROM public.orders
WHERE id = 'd0c3c5a8-9476-4aa6-8484-d1f90326804c'
LIMIT 1;

-- If not found by ID, try searching by partial match or recent bills
SELECT 'spartan' as table_name, id, bill_number, bill_date, order_id, status
FROM public.spartan
WHERE bill_number LIKE '%d0c3%'
   OR id LIKE '%d0c3%'
ORDER BY bill_date DESC
LIMIT 5;

SELECT 'fightor' as table_name, id, bill_number, bill_date, order_id, status
FROM public.fightor
WHERE bill_number LIKE '%d0c3%'
   OR id LIKE '%d0c3%'
ORDER BY bill_date DESC
LIMIT 5;

-- Get latest bills from both tables to see the structure
SELECT 'spartan' as table_name, id, bill_number, order_id, status, bill_date
FROM public.spartan
ORDER BY bill_date DESC
LIMIT 3;

SELECT 'fightor' as table_name, id, bill_number, order_id, status, bill_date
FROM public.fightor
ORDER BY bill_date DESC
LIMIT 3;
