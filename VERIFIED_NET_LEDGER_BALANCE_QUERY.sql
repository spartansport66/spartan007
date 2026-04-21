-- Verified Net Ledger Balance Calculation Query
-- Use this query in Supabase SQL Editor to validate dealer balances
-- Last verified: April 19, 2026

WITH dealer_data AS (
  SELECT 
    db.dealer_id,
    d.name as dealer_name,
    COALESCE(db.opening_balance, 0) as opening_balance
  FROM public.dealer_balances db
  JOIN public.dealers d ON db.dealer_id = d.id
  WHERE db.dealer_id = 'YOUR_DEALER_ID'
),
approved_invoices AS (
  SELECT 
    dealer_id,
    COALESCE(SUM(grand_total), 0) as total_approved_invoices
  FROM public.invoices
  WHERE dealer_id = 'YOUR_DEALER_ID'
    AND status = 'approve'
  GROUP BY dealer_id
),
completed_payments AS (
  SELECT 
    dealer_id,
    COALESCE(SUM(amount), 0) as total_completed_payments
  FROM public.payment_received
  WHERE dealer_id = 'YOUR_DEALER_ID'
    AND status = 'completed'
  GROUP BY dealer_id
)
SELECT 
  d.dealer_id,
  d.dealer_name,
  d.opening_balance,
  COALESCE(i.total_approved_invoices, 0) as total_approved_invoices,
  COALESCE(p.total_completed_payments, 0) as total_completed_payments,
  (d.opening_balance + COALESCE(i.total_approved_invoices, 0) - COALESCE(p.total_completed_payments, 0)) as net_ledger_balance
FROM dealer_data d
LEFT JOIN approved_invoices i ON d.dealer_id = i.dealer_id
LEFT JOIN completed_payments p ON d.dealer_id = p.dealer_id;
