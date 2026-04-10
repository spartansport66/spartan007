-- Create sales_target table to store monthly targets by sales person and month

CREATE TABLE IF NOT EXISTS public.sales_target (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sales_person_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_month DATE NOT NULL, -- First day of the month
  target_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sales_person_id, target_month)
);

-- Enable RLS
ALTER TABLE public.sales_target ENABLE ROW LEVEL SECURITY;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_target_sales_person_id ON public.sales_target(sales_person_id);
CREATE INDEX IF NOT EXISTS idx_sales_target_month ON public.sales_target(target_month);
CREATE INDEX IF NOT EXISTS idx_sales_target_person_month ON public.sales_target(sales_person_id, target_month);
