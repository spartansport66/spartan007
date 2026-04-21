-- Migration to add billing company to orders table
-- Allows tracking which company to bill for an order

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS billing_company_id UUID REFERENCES public.companies(id) DEFAULT NULL;

-- Create index on company_id for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_company_id ON public.orders(company_id);
CREATE INDEX IF NOT EXISTS idx_orders_billing_company_id ON public.orders(billing_company_id);

-- Add comments for documentation
COMMENT ON COLUMN public.orders.company_id IS 'The company that this order belongs to (selected during order editing)';
COMMENT ON COLUMN public.orders.billing_company_id IS 'Alternative company for billing (if different from company_id)';
