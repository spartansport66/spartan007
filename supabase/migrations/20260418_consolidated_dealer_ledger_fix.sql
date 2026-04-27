-- Comprehensive migration: Update get_dealer_ledger to use orders table bill_no only
-- This migration:
-- 1. Drops and recreates the get_dealer_ledger function to query from orders table only
-- 2. Removes dependency on invoices table for bill amounts
-- 3. Only includes orders where bill_no is not null
-- 4. Uses bill_amount from orders.total_amount instead of invoices.grand_total
-- 5. Sets SECURITY DEFINER to bypass RLS policies
-- 6. Ensures all necessary permissions are granted

-- First, drop the old function completely
DROP FUNCTION IF EXISTS public.get_dealer_ledger(uuid, boolean) CASCADE;

-- Create the new function with SECURITY DEFINER and bill_amount
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

  -- Dispatched billed orders with gate pass timestamp
  SELECT
    COALESCE(o.gate_pass_dispatch_time, o.dispatch_date, o.order_date)::date as transaction_date,
    'Order #' || o.order_number || ' / Bill #' || COALESCE(o.bill_no, 'N/A') || ' / Gatepass #' || COALESCE(o.dispatch_number::text, 'N/A') as details,
    o.total_amount as debit,
    0 as credit,
    o.total_amount as bill_amount,
    o.id as transaction_id,
    'order' as transaction_type
  FROM public.orders o
  WHERE o.dealer_id = dealer_id_param
  AND o.bill_no IS NOT NULL
  AND o.dispatched = true
  AND o.gate_pass_dispatch_time IS NOT NULL
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

-- GRANT EXECUTE permission on the function
GRANT EXECUTE ON FUNCTION public.get_dealer_ledger(uuid, boolean) TO authenticated;

-- Clean up RLS policies
DROP POLICY IF EXISTS "billing_view_invoices" ON public.invoices;
DROP POLICY IF EXISTS "billing_insert_invoices" ON public.invoices;
DROP POLICY IF EXISTS "billing_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "All authenticated users can SELECT invoices" ON public.invoices;
DROP POLICY IF EXISTS "Billing users and admins can UPDATE invoices" ON public.invoices;
DROP POLICY IF EXISTS "users_select_invoices" ON public.invoices;
DROP POLICY IF EXISTS "users_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "allow_authenticated_select_invoices" ON public.invoices;
DROP POLICY IF EXISTS "allow_anon_select_invoices" ON public.invoices;
DROP POLICY IF EXISTS "allow_billing_admin_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "allow_billing_admin_insert_invoices" ON public.invoices;

-- Create clean RLS policies
CREATE POLICY "authenticated_select_invoices" ON public.invoices
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "anon_select_invoices" ON public.invoices
FOR SELECT
TO anon
USING (true);

CREATE POLICY "billing_update_invoices" ON public.invoices
FOR UPDATE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
);

CREATE POLICY "billing_insert_invoices" ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
);

-- Add comment documenting the function
COMMENT ON FUNCTION public.get_dealer_ledger(uuid, boolean) IS 'Retrieves dealer transaction ledger with invoice bill amounts. Uses SECURITY DEFINER to access invoices table bypassing RLS policies.';
