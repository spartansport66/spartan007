-- Add freight charges column to orders table
-- This allows adding transportation/freight charges to orders

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS freight_charges NUMERIC DEFAULT 0 CHECK (freight_charges >= 0);

-- Create index for better filtering
CREATE INDEX IF NOT EXISTS idx_orders_freight_charges ON public.orders(freight_charges);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.freight_charges IS 'Transportation/freight charges to be added to the order total';
