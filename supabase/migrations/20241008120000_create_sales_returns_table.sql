-- Create a sequence for sales return numbers if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS public.sales_return_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create sales_returns table to log credit notes if it doesn't exist
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL,
  unit_price NUMERIC NOT NULL,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 0,
  total_credit_amount NUMERIC NOT NULL,
  return_date DATE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add the return_number column to the sales_returns table if it doesn't exist
ALTER TABLE public.sales_returns
ADD COLUMN IF NOT EXISTS return_number INT DEFAULT nextval('public.sales_return_number_seq');

-- Enable Row Level Security
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for the table
DROP POLICY IF EXISTS "Admins can manage all sales returns" ON public.sales_returns;
CREATE POLICY "Admins can manage all sales returns"
ON public.sales_returns FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Sales persons can view returns for their dealers" ON public.sales_returns;
CREATE POLICY "Sales persons can view returns for their dealers"
ON public.sales_returns FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM dealer_sales_persons dsp
    WHERE dsp.dealer_id = sales_returns.dealer_id AND dsp.sales_person_id = auth.uid()
  )
);