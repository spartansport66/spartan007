-- Create RPC function for Net Ledger Balance calculation
-- This function executes the proven working query that calculates:
-- Opening Balance + Approved Invoices - Completed Payments

DROP FUNCTION IF EXISTS public.get_net_ledger_balance(uuid);

CREATE FUNCTION public.get_net_ledger_balance(dealer_id_param uuid)
RETURNS TABLE (
  net_ledger_balance numeric
) LANGUAGE sql SECURITY DEFINER AS $$
  WITH dealer_data AS (
    SELECT 
      db.dealer_id,
      d.name as dealer_name,
      COALESCE(db.opening_balance, 0) as opening_balance
    FROM public.dealer_balances db
    JOIN public.dealers d ON db.dealer_id = d.id
    WHERE db.dealer_id = dealer_id_param
  ),
  approved_invoices AS (
    SELECT 
      dealer_id,
      COALESCE(SUM(grand_total), 0) as total_approved_invoices
    FROM public.invoices
    WHERE dealer_id = dealer_id_param
      AND status = 'approve'
    GROUP BY dealer_id
  ),
  completed_payments AS (
    SELECT 
      dealer_id,
      COALESCE(SUM(amount), 0) as total_completed_payments
    FROM public.payment_received
    WHERE dealer_id = dealer_id_param
      AND status = 'completed'
    GROUP BY dealer_id
  )
  SELECT 
    (d.opening_balance + COALESCE(i.total_approved_invoices, 0) - COALESCE(p.total_completed_payments, 0)) as net_ledger_balance
  FROM dealer_data d
  LEFT JOIN approved_invoices i ON d.dealer_id = i.dealer_id
  LEFT JOIN completed_payments p ON d.dealer_id = p.dealer_id;
$$;

-- Grant permission to all authenticated users
GRANT EXECUTE ON FUNCTION public.get_net_ledger_balance(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_net_ledger_balance(uuid) IS 'Calculates net ledger balance: Opening Balance + Approved Invoices - Completed Payments';
