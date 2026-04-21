-- Add approval workflow to orders table for Sales HOD approval
-- This allows orders to require approval before billing

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approval_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index on approval_status for faster filtering
CREATE INDEX IF NOT EXISTS idx_orders_approval_status ON public.orders(approval_status);

-- Add comment for documentation
COMMENT ON COLUMN public.orders.approval_status IS 'Order approval status: pending (awaiting HOD review), approved (ready for billing), rejected (not approved)';
COMMENT ON COLUMN public.orders.approved_by IS 'User ID of the Sales HOD who approved/rejected the order';
COMMENT ON COLUMN public.orders.approval_date IS 'Date when the order was approved or rejected by HOD';
COMMENT ON COLUMN public.orders.rejection_reason IS 'Reason for rejection if approval_status = rejected';
