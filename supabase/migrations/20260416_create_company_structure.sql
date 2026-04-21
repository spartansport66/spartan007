-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL,
  postal_code TEXT,
  gst_number TEXT,
  contact_number TEXT NOT NULL,
  email TEXT NOT NULL,
  website TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create financial_years table
CREATE TABLE IF NOT EXISTS public.financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year_name TEXT NOT NULL, -- e.g., "2024-2025", "FY2024"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, year_name)
);

-- Create bill_series table (for configuring bill numbering)
CREATE TABLE IF NOT EXISTS public.bill_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  financial_year_id UUID NOT NULL REFERENCES public.financial_years(id) ON DELETE CASCADE,
  series_prefix TEXT NOT NULL, -- e.g., "INV-2024-"
  series_separator TEXT, -- e.g., "-" or " "
  current_sequence_number INTEGER DEFAULT 1000,
  increment_by INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, financial_year_id)
);

-- Create indexes
CREATE INDEX idx_companies_is_active ON public.companies(is_active);
CREATE INDEX idx_financial_years_company_id ON public.financial_years(company_id);
CREATE INDEX idx_financial_years_is_active ON public.financial_years(is_active);
CREATE INDEX idx_bill_series_company_id ON public.bill_series(company_id);
CREATE INDEX idx_bill_series_financial_year_id ON public.bill_series(financial_year_id);

-- Add comments
COMMENT ON TABLE public.companies IS 'Stores multiple company information for billing and accounting purposes';
COMMENT ON TABLE public.financial_years IS 'Stores financial years for each company for accounting compliance';
COMMENT ON TABLE public.bill_series IS 'Stores bill numbering series configuration with auto-increment logic';

-- Insert default company (optional, can be customized later)
INSERT INTO public.companies (name, address, city, state, country, gst_number, contact_number, email, website, is_active)
VALUES (
  'Default Company',
  'Default Address',
  'Default City',
  'Default State',
  'India',
  NULL,
  '+91-9999999999',
  'info@example.com',
  'www.example.com',
  true
)
ON CONFLICT (name) DO NOTHING;
