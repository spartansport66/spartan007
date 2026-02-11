-- Create the payment_allocations table
CREATE TABLE public.payment_allocations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    liability_id UUID NOT NULL, -- This will reference either an order ID or a dealer_id for opening balance
    allocated_amount NUMERIC NOT NULL,
    allocation_type TEXT NOT NULL CHECK (allocation_type IN ('order', 'opening_balance')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add an index for performance
CREATE INDEX idx_payment_allocations_liability ON public.payment_allocations(liability_id, allocation_type);

-- Enable RLS
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can manage all allocations
CREATE POLICY "Admins can manage all payment allocations"
ON public.payment_allocations
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());

-- Sales persons can read allocations for their dealers
CREATE POLICY "Sales persons can read allocations for their dealers"
ON public.payment_allocations
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = payment_allocations.payment_id
      AND p.dealer_id IN (
        SELECT dsp.dealer_id
        FROM public.dealer_sales_persons dsp
        WHERE dsp.sales_person_id = auth.uid()
      )
  )
);

-- Sales persons can insert allocations for their dealers
CREATE POLICY "Sales persons can insert allocations for their dealers"
ON public.payment_allocations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.payments p
    WHERE p.id = payment_allocations.payment_id
      AND p.dealer_id IN (
        SELECT dsp.dealer_id
        FROM public.dealer_sales_persons dsp
        WHERE dsp.sales_person_id = auth.uid()
      )
  )
);