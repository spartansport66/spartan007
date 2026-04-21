-- Check all bill series records
SELECT 
  bs.id,
  bs.company_id,
  c.name as company_name,
  bs.financial_year_id,
  fy.year_name,
  bs.series_prefix,
  bs.series_separator,
  bs.current_sequence_number,
  bs.is_active
FROM bill_series bs
LEFT JOIN companies c ON bs.company_id = c.id
LEFT JOIN financial_years fy ON bs.financial_year_id = fy.id
ORDER BY c.name, fy.year_name;
