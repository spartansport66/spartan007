-- Add logo_url column to companies table
ALTER TABLE public.companies ADD COLUMN logo_url TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.companies.logo_url IS 'URL of the company logo stored in Supabase storage';
