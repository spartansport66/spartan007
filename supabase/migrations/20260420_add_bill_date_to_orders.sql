-- Migration to add bill_date to orders table
-- Tracks when a bill was generated for an order

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS bill_date DATE DEFAULT NULL;

-- Create index on bill_date for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_bill_date ON public.orders(bill_date);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.bill_date IS 'Date when the bill was generated for this order';
