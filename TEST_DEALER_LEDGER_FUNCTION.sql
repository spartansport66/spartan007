-- Test the get_dealer_ledger function directly
-- Replace 'YOUR_DEALER_ID' with: 40c457bf-3461-480e-a92e-1213c17b40f6

-- Get all ledger entries for the dealer
SELECT 
  transaction_date,
  details,
  transaction_type,
  debit,
  credit,
  bill_amount
FROM get_dealer_ledger('40c457bf-3461-480e-a92e-1213c17b40f6'::uuid, false)
ORDER BY transaction_date;

-- Count by transaction type
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(debit) as total_debit,
  SUM(credit) as total_credit
FROM get_dealer_ledger('40c457bf-3461-480e-a92e-1213c17b40f6'::uuid, false)
GROUP BY transaction_type;
