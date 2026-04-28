-- Add bill approval flag to orders table
-- This column is set when the account dashboard approves a bill for the linked order.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS bill_approved boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_bill_approved ON public.orders(bill_approved);

COMMENT ON COLUMN public.orders.bill_approved IS 'Flag indicating that the account dashboard has approved the bill for this order';
