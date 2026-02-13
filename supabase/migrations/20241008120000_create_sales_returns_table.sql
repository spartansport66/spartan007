-- Create sales_returns table to log credit notes
CREATE TABLE public.sales_returns (
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

-- Enable Row Level Security
ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for the new table
CREATE POLICY "Admins can manage all sales returns" ON public.sales_returns
FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Sales persons can view returns for their dealers" ON public.sales_returns
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM dealer_sales_persons dsp
    WHERE dsp.dealer_id = sales_returns.dealer_id AND dsp.sales_person_id = auth.uid()
  )
);