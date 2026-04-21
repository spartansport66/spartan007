-- Create invoices table (billing-specific schema)
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  financial_year_id UUID NOT NULL REFERENCES public.financial_years(id) ON DELETE RESTRICT,
  bill_series_id UUID NOT NULL REFERENCES public.bill_series(id) ON DELETE RESTRICT,
  bill_number TEXT NOT NULL UNIQUE, -- Generated from bill_series prefix + separator + sequence
  bill_date DATE NOT NULL,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE RESTRICT,
  gst_number TEXT, -- Denormalized from dealers for billing purposes
  total_amount DECIMAL(12, 2) NOT NULL,
  discount_amount DECIMAL(12, 2) DEFAULT 0,
  round_off DECIMAL(12, 2) DEFAULT 0,
  freight_charges DECIMAL(12, 2) DEFAULT 0,
  taxable_value DECIMAL(12, 2) NOT NULL,
  total_gst DECIMAL(12, 2) NOT NULL,
  grand_total DECIMAL(12, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'pending', -- pending, partial, paid
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

-- Create indexes
CREATE INDEX idx_invoices_bill_number ON public.invoices(bill_number);
CREATE INDEX idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX idx_invoices_financial_year_id ON public.invoices(financial_year_id);
CREATE INDEX idx_invoices_bill_date ON public.invoices(bill_date);
CREATE INDEX idx_invoices_dealer_id ON public.invoices(dealer_id);
CREATE INDEX idx_invoices_payment_status ON public.invoices(payment_status);
CREATE INDEX idx_invoices_order_id ON public.invoices(order_id);

-- Add comments
COMMENT ON TABLE public.invoices IS 'Billing invoices generated from orders with company and financial year tracking';
COMMENT ON COLUMN public.invoices.bill_number IS 'Auto-generated bill number from bill_series configuration';
COMMENT ON COLUMN public.invoices.taxable_value IS 'Total amount before GST';
COMMENT ON COLUMN public.invoices.total_gst IS 'Sum of all GST charges';
COMMENT ON COLUMN public.invoices.grand_total IS 'Final amount including GST, freight, and rounding';

-- Create function to generate next bill number
CREATE OR REPLACE FUNCTION generate_bill_number(
  p_bill_series_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_series_prefix TEXT;
  v_series_separator TEXT;
  v_next_sequence INTEGER;
  v_bill_number TEXT;
BEGIN
  -- Get current series config
  SELECT series_prefix, series_separator, current_sequence_number
  INTO v_series_prefix, v_series_separator, v_next_sequence
  FROM public.bill_series
  WHERE id = p_bill_series_id
  FOR UPDATE;

  -- Generate bill number
  v_bill_number := v_series_prefix || COALESCE(v_series_separator, '') || v_next_sequence::TEXT;

  -- Update sequence number
  UPDATE public.bill_series
  SET current_sequence_number = current_sequence_number + increment_by,
      updated_at = NOW()
  WHERE id = p_bill_series_id;

  RETURN v_bill_number;
END;
$$ LANGUAGE plpgsql;

-- Add RLS policies for invoices (if using RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Policy for billing users to view invoices
CREATE POLICY "billing_view_invoices" ON public.invoices
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.user_type = 'billing' OR profiles.user_type = 'admin')
  )
);

-- Policy for billing users to insert invoices
CREATE POLICY "billing_insert_invoices" ON public.invoices
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.user_type = 'billing' OR profiles.user_type = 'admin')
  )
);

-- Policy for billing users to update invoices
CREATE POLICY "billing_update_invoices" ON public.invoices
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.user_type = 'billing' OR profiles.user_type = 'admin')
  )
);
