-- Fix RLS policies to allow get_dealer_ledger function to work properly
-- The function needs to read from: orders, payments, dealer_balances, sales_returns, dealers

-- 1. Update orders table RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Drop any existing restrictive policies
DROP POLICY IF EXISTS "Online orders managers can view online orders" ON public.orders;
DROP POLICY IF EXISTS "Online orders managers can update online orders" ON public.orders;
DROP POLICY IF EXISTS "Online orders managers can delete online orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated_select_orders" ON public.orders;
DROP POLICY IF EXISTS "allow_authenticated_select_orders" ON public.orders;

-- Add permissive SELECT policy for authenticated users
CREATE POLICY "allow_authenticated_select_orders" ON public.orders
FOR SELECT
TO authenticated
USING (true);

-- 2. Update payments table RLS - CRITICAL: Must have SELECT policy
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop ALL old policies on payments table to start fresh
DROP POLICY IF EXISTS "allow_authenticated_select_payments" ON public.payments;
DROP POLICY IF EXISTS "authenticated_select_payments" ON public.payments;
DROP POLICY IF EXISTS "Online orders managers can delete payments for online orders" ON public.payments;
DROP POLICY IF EXISTS "authenticated_can_update_payments" ON public.payments;

-- Add SELECT policy for authenticated users (required for get_dealer_ledger function)
CREATE POLICY "allow_authenticated_select_payments" ON public.payments
FOR SELECT
TO authenticated
USING (true);

-- Add UPDATE policy for authenticated users
CREATE POLICY "authenticated_can_update_payments" ON public.payments
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Update dealer_balances table RLS
ALTER TABLE public.dealer_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_dealer_balances" ON public.dealer_balances;
DROP POLICY IF EXISTS "allow_authenticated_select_dealer_balances" ON public.dealer_balances;

CREATE POLICY "allow_authenticated_select_dealer_balances" ON public.dealer_balances
FOR SELECT
TO authenticated
USING (true);

-- 4. Update sales_returns table RLS
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_sales_returns" ON public.sales_returns;
DROP POLICY IF EXISTS "allow_authenticated_select_sales_returns" ON public.sales_returns;

CREATE POLICY "allow_authenticated_select_sales_returns" ON public.sales_returns
FOR SELECT
TO authenticated
USING (true);

-- 5. Update dealers table RLS (also used in the function)
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_dealers" ON public.dealers;
DROP POLICY IF EXISTS "allow_authenticated_select_dealers" ON public.dealers;

CREATE POLICY "allow_authenticated_select_dealers" ON public.dealers
FOR SELECT
TO authenticated
USING (true);

-- 6. Ensure payment_allocations table also has proper RLS
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_authenticated_select_payment_allocations" ON public.payment_allocations;

CREATE POLICY "allow_authenticated_select_payment_allocations" ON public.payment_allocations
FOR SELECT
TO authenticated
USING (true);

-- Verify policies are in place - check browser console for results
-- SELECT * FROM get_dealer_ledger('YOUR_DEALER_ID'::uuid, false);