-- 1. Ensure RLS is enabled on the dealers table
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

-- 2. Drop the existing SELECT policy for authenticated users (if it exists and is restrictive)
-- Note: You might need to adjust the policy name if yours is different.
-- We will create a new, comprehensive policy.
DROP POLICY IF EXISTS "Allow authenticated users to read dealers" ON public.dealers;
DROP POLICY IF EXISTS "Admins and Managers can read all dealers" ON public.dealers;
DROP POLICY IF EXISTS "Sales persons can read their assigned dealers" ON public.dealers;

-- 3. Create a policy allowing Admins and Managers to read ALL dealers, 
--    and Sales Persons to read their ASSIGNED dealers.
CREATE POLICY "Admins, Managers, and Sales Persons can read relevant dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  -- Admins and Managers can read all rows
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
)
WITH CHECK (
  -- Sales Persons can only read dealers assigned to them
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_person' AND
  id IN (SELECT dealer_id FROM public.dealer_sales_persons WHERE sales_person_id = auth.uid())
);

-- FIX: The above policy structure is incorrect for combining OR logic in RLS.
-- A simpler, more robust approach for this scenario is two separate policies:

-- Policy 1: Allow Admins and Managers to read ALL dealers
CREATE POLICY "Admins and Managers can read all dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager')
);

-- Policy 2: Allow Sales Persons to read their assigned dealers
CREATE POLICY "Sales persons can read their assigned dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_person' AND
  id IN (SELECT dealer_id FROM public.dealer_sales_persons WHERE sales_person_id = auth.uid())
);