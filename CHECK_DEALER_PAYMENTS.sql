-- Check what payments exist for the dealer
-- Replace 'YOUR_DEALER_ID' with the actual dealer ID: 40c457bf-3461-480e-a92e-1213c17b40f6

SELECT 
  p.id,
  p.dealer_id,
  p.payment_date,
  p.amount,
  p.payment_method,
  p.status,
  p.source,
  p.transaction_id,
  p.cheque_dd_no,
  p.cheque_dd_date
FROM public.payments p
WHERE p.dealer_id = '40c457bf-3461-480e-a92e-1213c17b40f6'
ORDER BY p.payment_date DESC;

-- Also check if payments are linked via payment_allocations instead
SELECT 
  pa.id,
  pa.liability_id,
  pa.payment_id,
  pa.allocated_amount,
  pa.allocation_type,
  p.status,
  p.amount,
  p.payment_date
FROM public.payment_allocations pa
JOIN public.payments p ON pa.payment_id = p.id
WHERE pa.liability_id = '40c457bf-3461-480e-a92e-1213c17b40f6'
  AND pa.allocation_type = 'opening_balance'
ORDER BY p.payment_date DESC;

-- Check completed payments for this dealer
SELECT COUNT(*) as completed_payment_count, SUM(amount) as total_amount
FROM public.payments
WHERE dealer_id = '40c457bf-3461-480e-a92e-1213c17b40f6'
AND status = 'completed';

-- Check all payments regardless of status
SELECT status, COUNT(*) as count, SUM(amount) as total
FROM public.payments
WHERE dealer_id = '40c457bf-3461-480e-a92e-1213c17b40f6'
GROUP BY status;
