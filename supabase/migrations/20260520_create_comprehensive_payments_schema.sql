-- Comprehensive Payments Schema for Payment Dashboard
-- Enhances existing payments table with approval status and additional fields

-- 1. Ensure payments table has all required columns
-- First check if columns exist, if not add them
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transaction_reference text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' NOT NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS approval_date timestamp with time zone;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS remarks text;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' NOT NULL;

-- 2. Clean up existing records to ensure all have valid values
-- Set any NULL or invalid approval_status values to 'approved'
UPDATE public.payments 
SET approval_status = 'approved'
WHERE approval_status IS NULL 
   OR approval_status NOT IN ('pending', 'approved', 'rejected');

-- Set approval_date for existing approved payments (use payment_date as fallback)
UPDATE public.payments 
SET approval_date = payment_date::timestamp with time zone
WHERE approval_status = 'approved' 
  AND approval_date IS NULL;

-- Set any NULL or invalid status values to 'approved'
UPDATE public.payments 
SET status = 'approved'
WHERE status IS NULL 
   OR status NOT IN ('pending', 'approved', 'rejected');

-- Now add constraints after all data is valid
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_approval_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_approval_status_check 
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- Set defaults for future rows
ALTER TABLE public.payments
  ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE public.payments
  ALTER COLUMN status SET DEFAULT 'pending';

-- 3. Create trigger to automatically set approval_date when status changes
CREATE OR REPLACE FUNCTION public.update_payment_approval_date()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approval_status != OLD.approval_status AND NEW.approval_status = 'approved' THEN
    NEW.approval_date = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS set_payment_approval_date ON public.payments;
CREATE TRIGGER set_payment_approval_date
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_payment_approval_date();

-- 4. Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_approval_status ON public.payments(approval_status);
CREATE INDEX IF NOT EXISTS idx_payments_dealer_date ON public.payments(dealer_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_created_date ON public.payments(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- 5. Create Payment Approval Workflow Table
CREATE TABLE IF NOT EXISTS public.payment_approvals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamp with time zone DEFAULT now(),
  approval_level integer NOT NULL DEFAULT 1,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  remarks text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_approvals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_approvals_payment_id ON public.payment_approvals(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_approvals_status ON public.payment_approvals(status);

-- 6. Create Payment Request Log Table
CREATE TABLE IF NOT EXISTS public.payment_request_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  action text NOT NULL,
  action_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action_date timestamp with time zone DEFAULT now(),
  previous_status text,
  new_status text,
  remarks text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_request_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_request_logs_payment_id ON public.payment_request_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_request_logs_action_date ON public.payment_request_logs(action_date);

-- 7. Create helper function for payment operations (must be created BEFORE RLS policies)
CREATE OR REPLACE FUNCTION public.is_payment_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) = 'payment';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create or replace is_admin function to be safe
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Enable RLS on payments and related tables
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
DROP POLICY IF EXISTS "Payment users can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Users can view their dealer payments" ON public.payments;

-- RLS Policy for payment users - can view and create payments for all dealers
CREATE POLICY "Payment users can manage payments" ON public.payments
FOR ALL
USING (public.is_payment_user() OR public.is_admin())
WITH CHECK (public.is_payment_user() OR public.is_admin());

-- RLS Policy for other authenticated users - can only view their dealer payments
CREATE POLICY "Users can view their dealer payments" ON public.payments
FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM public.dealers WHERE id = dealer_id
  ) OR
  public.is_admin()
);

-- Function to get pending payments for approval
CREATE OR REPLACE FUNCTION public.get_pending_payments(
  p_approval_status text DEFAULT 'pending'
)
RETURNS TABLE (
  payment_id uuid,
  dealer_id uuid,
  dealer_name text,
  amount_paid numeric,
  payment_date date,
  payment_method text,
  transaction_reference text,
  created_by_name text,
  approval_status text,
  created_at timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as payment_id,
    p.dealer_id,
    d.name as dealer_name,
    p.amount as amount_paid,
    p.payment_date,
    p.payment_method,
    p.transaction_reference,
    COALESCE(pr.first_name || ' ' || pr.last_name, 'System') as created_by_name,
    p.approval_status,
    p.created_at
  FROM public.payments p
  LEFT JOIN public.dealers d ON p.dealer_id = d.id
  LEFT JOIN public.profiles pr ON p.recorded_by = pr.id
  WHERE (p_approval_status IS NULL OR p.approval_status = p_approval_status)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get approved payments report
CREATE OR REPLACE FUNCTION public.get_approved_payments(
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date date DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  payment_id uuid,
  dealer_id uuid,
  dealer_name text,
  amount_paid numeric,
  payment_date date,
  approved_date timestamp with time zone,
  approved_by_name text,
  payment_method text,
  transaction_reference text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as payment_id,
    p.dealer_id,
    d.name as dealer_name,
    p.amount as amount_paid,
    p.payment_date,
    p.approval_date as approved_date,
    COALESCE(pr.first_name || ' ' || pr.last_name, 'System') as approved_by_name,
    p.payment_method,
    p.transaction_reference
  FROM public.payments p
  LEFT JOIN public.dealers d ON p.dealer_id = d.id
  LEFT JOIN public.profiles pr ON p.approved_by = pr.id
  WHERE p.approval_status = 'approved' 
    AND p.payment_date >= p_start_date 
    AND p.payment_date <= p_end_date
  ORDER BY p.payment_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get dealer ledger
CREATE OR REPLACE FUNCTION public.get_dealer_ledger(
  p_dealer_id uuid DEFAULT NULL,
  p_start_date date DEFAULT CURRENT_DATE - INTERVAL '90 days'
)
RETURNS TABLE (
  transaction_date date,
  transaction_type text,
  order_number integer,
  bill_number text,
  debit_amount numeric,
  credit_amount numeric,
  running_balance numeric,
  dealer_name text
) AS $$
DECLARE
  v_running_balance numeric := 0;
  v_dealer_name text;
BEGIN
  -- Get dealer name if specific dealer provided
  IF p_dealer_id IS NOT NULL THEN
    SELECT name INTO v_dealer_name FROM public.dealers WHERE id = p_dealer_id;
  END IF;

  -- Get opening balance
  SELECT COALESCE(balance, 0) INTO v_running_balance FROM public.opening_balance;

  -- Return combined ledger
  RETURN QUERY
  SELECT
    COALESCE(ord.order_date::date, pay.payment_date) as transaction_date,
    CASE 
      WHEN ord.id IS NOT NULL THEN 'Order'
      WHEN pay.id IS NOT NULL THEN 'Payment'
      ELSE 'Other'
    END as transaction_type,
    ord.order_number,
    ord.bill_no as bill_number,
    CASE WHEN ord.id IS NOT NULL THEN ord.total_amount ELSE 0 END as debit_amount,
    CASE WHEN pay.id IS NOT NULL THEN pay.amount ELSE 0 END as credit_amount,
    0 as running_balance, -- Will be calculated in app
    COALESCE(d.name, v_dealer_name, 'Unknown') as dealer_name
  FROM (
    SELECT id, order_date, order_number, bill_no, total_amount, dealer_id FROM public.orders
    WHERE (p_dealer_id IS NULL OR dealer_id = p_dealer_id)
      AND order_date::date >= p_start_date
  ) ord
  FULL OUTER JOIN (
    SELECT id, payment_date, amount_paid, dealer_id FROM public.payments
    WHERE (p_dealer_id IS NULL OR dealer_id = p_dealer_id)
      AND payment_date >= p_start_date
  ) pay ON ord.dealer_id = pay.dealer_id
  LEFT JOIN public.dealers d ON COALESCE(ord.dealer_id, pay.dealer_id) = d.id
  ORDER BY transaction_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
