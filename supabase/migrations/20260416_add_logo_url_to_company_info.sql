-- Add logo_url column to company_info table for storing company logo
ALTER TABLE public.company_info
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.company_info.logo_url IS 'URL to the company logo image stored in Supabase storage. Used in bills, invoices, and reports.';

-- Grant permissions to authenticated users
GRANT UPDATE ON public.company_info TO authenticated;
