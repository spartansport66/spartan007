-- Add RLS policies for bill_series table to allow billing users to read bill numbers

-- Enable RLS on bill_series if not already enabled
ALTER TABLE public.bill_series ENABLE ROW LEVEL SECURITY;

-- Create policy for billing users to SELECT bill_series
CREATE POLICY "billing_select_bill_series" ON public.bill_series
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'user_type' IN ('billing', 'admin')
  );

-- Create policy for billing users to INSERT bill_series
CREATE POLICY "billing_insert_bill_series" ON public.bill_series
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'user_type' IN ('billing', 'admin')
  );

-- Create policy for billing users to UPDATE bill_series
CREATE POLICY "billing_update_bill_series" ON public.bill_series
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'user_type' IN ('billing', 'admin')
  )
  WITH CHECK (
    auth.jwt() ->> 'user_type' IN ('billing', 'admin')
  );

-- Test query to verify access
SELECT bs.id, bs.series_prefix, bs.current_sequence_number, c.name, fy.year_name
FROM public.bill_series bs
JOIN public.companies c ON bs.company_id = c.id
JOIN public.financial_years fy ON bs.financial_year_id = fy.id
LIMIT 5;
