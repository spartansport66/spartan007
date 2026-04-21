-- Add tracking fields for invoice reassignment
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS reassigned_from_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reassigned_to_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reassignment_reason TEXT,
ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE;

-- Create index for tracking reassignments
CREATE INDEX IF NOT EXISTS idx_invoices_reassignment ON public.invoices(reassigned_from_invoice_id, reassigned_to_invoice_id);

COMMENT ON COLUMN public.invoices.reassigned_from_invoice_id IS 'Original invoice ID if this is a reassignment (company change)';
COMMENT ON COLUMN public.invoices.reassigned_to_invoice_id IS 'New invoice ID this was reassigned to';
COMMENT ON COLUMN public.invoices.reassignment_reason IS 'Reason for reassignment (e.g., "Company changed from M to S")';
COMMENT ON COLUMN public.invoices.reassigned_at IS 'When the reassignment happened';
