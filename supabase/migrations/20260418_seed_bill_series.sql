-- Migration to auto-generate bill_series records for all active companies and financial years
-- This ensures every company/FY combination has a bill series for invoice numbering

INSERT INTO public.bill_series (company_id, financial_year_id, series_prefix, series_separator, current_sequence_number, increment_by, is_active)
SELECT 
  c.id as company_id,
  fy.id as financial_year_id,
  c.name || '-' || fy.year_name as series_prefix,  -- e.g., "Company Name-2024-2025"
  '-' as series_separator,
  1000 as current_sequence_number,
  1 as increment_by,
  true as is_active
FROM public.companies c
CROSS JOIN public.financial_years fy
WHERE c.is_active = true
  AND fy.is_active = true
  AND c.id = fy.company_id  -- Only match FY for that company
  AND NOT EXISTS (
    -- Don't create if already exists
    SELECT 1 FROM public.bill_series bs
    WHERE bs.company_id = c.id
    AND bs.financial_year_id = fy.id
  )
ON CONFLICT (company_id, financial_year_id) DO NOTHING;

-- Verify the inserts
SELECT 
  c.name as company_name,
  fy.year_name as financial_year,
  bs.series_prefix,
  bs.current_sequence_number,
  bs.is_active
FROM public.bill_series bs
JOIN public.companies c ON bs.company_id = c.id
JOIN public.financial_years fy ON bs.financial_year_id = fy.id
ORDER BY c.name, fy.year_name;
