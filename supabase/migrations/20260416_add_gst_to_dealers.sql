-- Add GST number column to dealers table
ALTER TABLE public.dealers
ADD COLUMN IF NOT EXISTS gst_number TEXT,
ADD COLUMN IF NOT EXISTS gst_registration_type TEXT DEFAULT 'unregistered';

-- Create index on GST number for faster lookups
CREATE INDEX IF NOT EXISTS idx_dealers_gst_number ON public.dealers(gst_number);

-- Add comment for documentation
COMMENT ON COLUMN public.dealers.gst_number IS 'Goods and Services Tax registration number of the dealer';
COMMENT ON COLUMN public.dealers.gst_registration_type IS 'Type of GST registration: registered, unregistered, composition, etc.';
