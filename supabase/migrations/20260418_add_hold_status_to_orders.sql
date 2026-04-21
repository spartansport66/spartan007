-- Migration to add hold status columns to orders table
-- This allows tracking which orders are on hold and why

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS hold_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS hold_reason TEXT DEFAULT NULL;

-- Add constraint to hold_status to allow only specific values
ALTER TABLE public.orders
ADD CONSTRAINT hold_status_values CHECK (hold_status IS NULL OR hold_status IN ('active', 'released'));

-- Create index on hold_status for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_hold_status ON public.orders(hold_status);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.hold_status IS 'Status of order hold: NULL (not held), "active" (currently held), "released" (was held but released)';
COMMENT ON COLUMN public.orders.hold_reason IS 'Reason for placing order on hold';
