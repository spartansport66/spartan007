-- Fix RLS Policies for spartan and fightor tables
-- These tables were created from invoices, so they inherited the RLS policies
-- We need to update or create proper RLS policies for the new company-specific tables

-- 1. DROP existing RLS policies on spartan table (if any)
DROP POLICY IF EXISTS "Users can view invoices for their company" ON public.spartan;
DROP POLICY IF EXISTS "Users can insert invoices for their company" ON public.spartan;
DROP POLICY IF EXISTS "Users can update invoices for their company" ON public.spartan;
DROP POLICY IF EXISTS "Users can delete invoices for their company" ON public.spartan;

-- 2. DROP existing RLS policies on fightor table (if any)
DROP POLICY IF EXISTS "Users can view invoices for their company" ON public.fightor;
DROP POLICY IF EXISTS "Users can insert invoices for their company" ON public.fightor;
DROP POLICY IF EXISTS "Users can update invoices for their company" ON public.fightor;
DROP POLICY IF EXISTS "Users can delete invoices for their company" ON public.fightor;

-- 3. ENABLE RLS on spartan table
ALTER TABLE public.spartan ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies for spartan table
CREATE POLICY "spartan: allow all authenticated users to view" 
  ON public.spartan 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "spartan: allow all authenticated users to insert" 
  ON public.spartan 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "spartan: allow all authenticated users to update" 
  ON public.spartan 
  FOR UPDATE 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "spartan: allow all authenticated users to delete" 
  ON public.spartan 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- 5. ENABLE RLS on fightor table
ALTER TABLE public.fightor ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for fightor table
CREATE POLICY "fightor: allow all authenticated users to view" 
  ON public.fightor 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

CREATE POLICY "fightor: allow all authenticated users to insert" 
  ON public.fightor 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fightor: allow all authenticated users to update" 
  ON public.fightor 
  FOR UPDATE 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "fightor: allow all authenticated users to delete" 
  ON public.fightor 
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- 7. Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spartan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fightor TO authenticated;
