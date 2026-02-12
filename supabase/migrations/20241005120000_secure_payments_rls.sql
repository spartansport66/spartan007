-- Drop the overly permissive SELECT policy that allowed any authenticated user to see all payments.
-- The more specific policies for Admins and Sales Persons will now correctly apply.
DROP POLICY IF EXISTS "Allow authenticated users to read payments" ON public.payments;

-- Drop the overly permissive INSERT policy.
-- More specific policies already exist for sales persons and admins.
DROP POLICY IF EXISTS "Allow authenticated users to insert payments" ON public.payments;

-- Drop the overly permissive UPDATE policy.
-- More specific policies already exist for sales persons and admins.
DROP POLICY IF EXISTS "Allow authenticated users to update payments" ON public.payments;