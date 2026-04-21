-- Migration to add urgent status to orders table
-- This allows marking orders as urgent to bypass FIFO billing rule

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS urgent_marked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS urgent_marked_by TEXT DEFAULT NULL;

-- Create index on is_urgent for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_is_urgent ON public.orders(is_urgent);

-- Add comments for documentation
COMMENT ON COLUMN public.orders.is_urgent IS 'Whether this order is marked as urgent (allows billing out of FIFO order)';
COMMENT ON COLUMN public.orders.urgent_marked_at IS 'Timestamp when the order was marked as urgent';
COMMENT ON COLUMN public.orders.urgent_marked_by IS 'User ID who marked the order as urgent';
