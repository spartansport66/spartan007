-- Add credit note entries to dealer ledger reports and allow billing/admin users to read credit notes.
--
-- This migration updates the dealer ledger function to include approved credit notes
-- and makes credit note rows visible to billing and admin users for reporting.

DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid, boolean);

CREATE FUNCTION public.get_dealer_ledger(
  dealer_id_param uuid,
  p_show_pending_only boolean DEFAULT false
)
RETURNS TABLE(
  transaction_date date,
  details text,
  debit numeric,
  credit numeric,
  bill_amount numeric,
  transaction_id uuid,
  transaction_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM (
  -- Opening Balance
  SELECT
    COALESCE(d.last_billing_date, '1970-01-01'::date) as transaction_date,
    'Opening Balance' as details,
    db.opening_balance as debit,
    0 as credit,
    0 as bill_amount,
    d.id as transaction_id,
    'opening_balance' as transaction_type
  FROM public.dealer_balances db
  JOIN public.dealers d ON db.dealer_id = d.id
  WHERE db.dealer_id = dealer_id_param
  AND (
    p_show_pending_only = false OR
    (
      p_show_pending_only = true AND
      db.opening_balance > (
        SELECT COALESCE(SUM(pa.allocated_amount), 0)
        FROM public.payment_allocations pa
        JOIN public.payments p ON pa.payment_id = p.id
        WHERE pa.liability_id = dealer_id_param
        AND pa.allocation_type = 'opening_balance'
        AND p.status = 'completed'
      )
    )
  )

  UNION ALL

  -- Dispatched Orders (with bill_no from orders table only)
  SELECT
    o.dispatch_date::date as transaction_date,
    'Order #' || o.order_number || ' / Bill #' || COALESCE(o.bill_no, 'N/A') || ' / Gatepass #' || COALESCE(o.dispatch_number::text, 'N/A') as details,
    o.total_amount as debit,
    0 as credit,
    o.total_amount as bill_amount,
    o.id as transaction_id,
    'order' as transaction_type
  FROM public.orders o
  WHERE o.dealer_id = dealer_id_param
  AND o.dispatched = true
  AND o.dispatch_date IS NOT NULL
  AND o.bill_no IS NOT NULL
  AND (
    p_show_pending_only = false OR
    (
      p_show_pending_only = true AND
      o.total_amount > (
        SELECT COALESCE(SUM(pa.allocated_amount), 0)
        FROM public.payment_allocations pa
        JOIN public.payments p ON pa.payment_id = p.id
        WHERE pa.liability_id = o.id
        AND pa.allocation_type = 'order'
        AND p.status = 'completed'
      )
    )
  )

  UNION ALL

  -- Credit Notes
  SELECT
    COALESCE(cn.credit_note_date, cn.created_at)::date as transaction_date,
    'Credit Note #' || cn.credit_note_number || ' - ' || initcap(replace(cn.status, '_', ' ')) ||
      COALESCE(' - ' || NULLIF(TRIM(cn.description), ''), '') as details,
    0 as debit,
    cn.credit_amount as credit,
    0 as bill_amount,
    cn.id as transaction_id,
    'credit_note' as transaction_type
  FROM public.credit_notes cn
  WHERE cn.dealer_id = dealer_id_param
    AND cn.approval_status = 'approved'
    AND cn.status <> 'cancelled'

  UNION ALL

  -- Completed Payments
  SELECT
    p.payment_date::date as transaction_date,
    'Payment Received (' || p.payment_method || ') - Ref: ' || COALESCE(p.transaction_id, p.cheque_dd_no, 'N/A') as details,
    0 as debit,
    p.amount as credit,
    0 as bill_amount,
    p.id as transaction_id,
    'payment' as transaction_type
  FROM public.payments p
  WHERE p.dealer_id = dealer_id_param
  AND p.status = 'completed'
  AND p_show_pending_only = false

  UNION ALL

  -- Pending Approval Payments
  SELECT
    p.payment_date::date as transaction_date,
    'Payment Pending Approval (' || p.payment_method || ') - Ref: ' || COALESCE(p.transaction_id, p.cheque_dd_no, 'N/A') || ' - Due: ' || TO_CHAR(p.cheque_dd_date, 'DD/MM/YYYY') as details,
    0 as debit,
    p.amount as credit,
    0 as bill_amount,
    p.id as transaction_id,
    'payment' as transaction_type
  FROM public.payments p
  WHERE p.dealer_id = dealer_id_param
  AND p.status = 'pending_approval'
  AND p.source = 'voucher'

  UNION ALL

  -- Sales Returns
  SELECT
    sr.return_date as transaction_date,
    'Sales Return #' || sr.return_number || ' (Order #' || o.order_number || ')' as details,
    0 as debit,
    sr.total_credit_amount as credit,
    0 as bill_amount,
    sr.id as transaction_id,
    'sales_return' as transaction_type
  FROM public.sales_returns sr
  JOIN public.orders o ON sr.order_id = o.id
  WHERE o.dealer_id = dealer_id_param
  AND o.dispatched = true
  AND o.dispatch_date IS NOT NULL
  AND p_show_pending_only = false

  ) AS combined_results
  ORDER BY 
    CASE WHEN transaction_type = 'opening_balance' THEN 0 ELSE 1 END ASC,
    transaction_date ASC, 
    transaction_id ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_dealer_ledger(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "credit_notes_select_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_select_policy" ON public.credit_notes
FOR SELECT USING (
  auth.uid() = created_by OR
  auth.uid() = approved_by OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        COALESCE(p.is_admin, false) = true OR
        p.user_type IN ('billing', 'admin', 'super_admin')
      )
  )
);

GRANT SELECT ON public.credit_notes TO authenticated;
