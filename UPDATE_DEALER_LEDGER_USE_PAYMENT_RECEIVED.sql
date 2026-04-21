-- Update get_dealer_ledger function to use payment_received table instead of payments table
-- This migration replaces the payments section to read from payment_received with correct status logic

DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid, boolean) CASCADE;

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
        JOIN public.payment_received p ON pa.payment_id = p.id
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
        JOIN public.payment_received p ON pa.payment_id = p.id
        WHERE pa.liability_id = o.id
        AND pa.allocation_type = 'order'
        AND p.status = 'completed'
      )
    )
  )

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

-- GRANT EXECUTE permission on the function
GRANT EXECUTE ON FUNCTION public.get_dealer_ledger(uuid, boolean) TO authenticated;

-- Add RLS policies for payment_received table
ALTER TABLE public.payment_received ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "allow_authenticated_select_payment_received" ON public.payment_received;
DROP POLICY IF EXISTS "allow_authenticated_insert_payment_received" ON public.payment_received;
DROP POLICY IF EXISTS "allow_authenticated_update_payment_received" ON public.payment_received;
DROP POLICY IF EXISTS "allow_authenticated_delete_payment_received" ON public.payment_received;

-- Create permissive policies for authenticated users
CREATE POLICY "allow_authenticated_select_payment_received" ON public.payment_received
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "allow_authenticated_insert_payment_received" ON public.payment_received
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "allow_authenticated_update_payment_received" ON public.payment_received
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "allow_authenticated_delete_payment_received" ON public.payment_received
FOR DELETE
TO authenticated
USING (true);

-- Add comment documenting the function
COMMENT ON FUNCTION public.get_dealer_ledger(uuid, boolean) IS 'Retrieves dealer transaction ledger (orders and opening balance only). Payments are queried separately from payment_received table. Uses SECURITY DEFINER to access tables bypassing RLS policies.';
