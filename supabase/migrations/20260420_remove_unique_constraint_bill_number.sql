-- Remove UNIQUE constraint from invoices.bill_number to allow updates
-- When a bill is reassigned to a different company, the bill_number needs to be updated

-- Drop the old unique constraint
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_bill_number_key;

-- Drop the old index
DROP INDEX IF EXISTS idx_invoices_bill_number;

-- Create a regular index (not unique) for faster queries
CREATE INDEX idx_invoices_bill_number ON public.invoices(bill_number);

COMMENT ON INDEX idx_invoices_bill_number IS 'Index for faster bill_number lookups (non-unique to allow updates)';
