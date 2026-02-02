-- Enable RLS on the dealers table if not already enabled
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow managers to read all dealers" ON public.dealers;
DROP POLICY IF EXISTS "Allow sales persons to read assigned dealers" ON public.dealers;
DROP POLICY IF EXISTS "Allow admins to manage all dealers" ON public.dealers;

-- Policy 1: Allow Admins to manage all dealers (SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "Allow admins to manage all dealers"
ON public.dealers
FOR ALL
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
) WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- Policy 2: Allow Managers to read all dealers (for counting/reporting)
-- Managers can SELECT all rows, but cannot INSERT, UPDATE, or DELETE.
CREATE POLICY "Allow managers to read all dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'manager'
);

-- Policy 3: Allow Sales Persons to read assigned dealers (SELECT)
CREATE POLICY "Allow sales persons to read assigned dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.dealer_sales_persons
    WHERE dealer_sales_persons.dealer_id = dealers.id
      AND dealer_sales_persons.sales_person_id = auth.uid()
  )
);

-- Policy 4: Allow Sales Persons to insert/update their own dealers (INSERT, UPDATE)
CREATE POLICY "Allow sales persons to insert/update their own dealers"
ON public.dealers
FOR ALL
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_person'
) WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_person'
);