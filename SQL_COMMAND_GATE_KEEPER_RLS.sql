CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create a function to check if the current user is a gate_keeper
CREATE OR REPLACE FUNCTION is_gate_keeper()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'gate_keeper'
  );
$$;

-- 2. Create the RLS policy on the orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gate Keepers can authorize final dispatch" ON public.orders;
CREATE POLICY "Gate Keepers can authorize final dispatch"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    is_gate_keeper() AND dispatched = TRUE AND bill_no IS NOT NULL
  )
  WITH CHECK (
    is_gate_keeper() AND dispatched = TRUE AND bill_no IS NOT NULL
  );

-- 3. RLS Policy for 'dealers' table: Allow Gate Keepers to read all dealer data
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gate Keepers can read all dealers" ON public.dealers;
CREATE POLICY "Gate Keepers can read all dealers"
  ON public.dealers
  FOR SELECT
  TO authenticated
  USING (
    is_gate_keeper()
  );

-- 4. RLS Policy for 'profiles' table: Allow Gate Keepers to read all profiles (to resolve sales person names)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gate Keepers can read all profiles" ON public.profiles;
CREATE POLICY "Gate Keepers can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    is_gate_keeper()
  );