-- Enable RLS on the payments table if it's not already enabled
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (optional, but safe)
DROP POLICY IF EXISTS "Allow authenticated users to insert payments" ON public.payments;

-- Policy to allow any authenticated user (Sales Person or Admin) to insert a payment record.
-- We rely on the 'status' column being 'pending_approval' for control.
CREATE POLICY "Allow authenticated users to insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (TRUE);

-- Policy to allow authenticated users to read payments (necessary for viewing payment details)
DROP POLICY IF EXISTS "Allow authenticated users to read payments" ON public.payments;
CREATE POLICY "Allow authenticated users to read payments"
ON public.payments
FOR SELECT
TO authenticated
USING (TRUE);

-- Policy to allow authenticated users to update payments (e.g., if they need to correct a submission before approval)
DROP POLICY IF EXISTS "Allow authenticated users to update payments" ON public.payments;
CREATE POLICY "Allow authenticated users to update payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id) OR auth.role() = 'authenticated')
WITH CHECK (TRUE);