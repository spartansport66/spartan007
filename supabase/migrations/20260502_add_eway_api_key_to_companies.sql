-- Add E-way API key to companies for sender-specific E-way bill credentials

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS eway_api_key TEXT;
