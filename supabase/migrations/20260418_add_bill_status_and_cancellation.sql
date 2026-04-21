-- Add status and cancellation_reason columns to invoices table
-- This enables tracking bill approval status and cancellation reasons

ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'reject', 'cancelled')),
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT NULL;

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- Add comments for documentation
COMMENT ON COLUMN public.invoices.status IS 'Bill status: pending (awaiting approval), approved (approved for payment), reject (rejected with reason), cancelled (cancelled with reason)';
COMMENT ON COLUMN public.invoices.cancellation_reason IS 'Reason for bill cancellation (only populated if status = cancelled)';
COMMENT ON COLUMN public.invoices.rejection_reason IS 'Reason for bill rejection (only populated if status = reject)';
