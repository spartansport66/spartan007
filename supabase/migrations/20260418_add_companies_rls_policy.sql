-- Add RLS policy for companies table to allow billing users read access
-- This ensures billing users can view all companies when generating bills

-- Enable RLS on companies table if not already enabled
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Policy for billing users to select companies
CREATE POLICY billing_select_companies ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.jwt() ->> 'user_type') = 'billing'
    OR (SELECT auth.jwt() ->> 'user_type') = 'admin'
    OR (SELECT auth.jwt() ->> 'user_type') = 'manager'
  );

-- Policy for public read access (fallback) - comment out if not needed
CREATE POLICY public_select_companies ON public.companies
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comment
COMMENT ON POLICY billing_select_companies ON public.companies IS 'Allow billing, admin, and manager users to view all companies';
