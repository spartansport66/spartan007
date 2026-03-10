-- Check RLS policies on online_order_staging
SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'online_order_staging'
ORDER BY policyname;

-- If policies are blocking quantity updates, run this to allow quantity field in INSERT/UPDATE:

-- Remove existing policies that might be blocking
DROP POLICY IF EXISTS "Enable insert for authenticated users on online_order_staging" ON public.online_order_staging;
DROP POLICY IF EXISTS "Enable update for authenticated users on online_order_staging" ON public.online_order_staging;
DROP POLICY IF EXISTS "Enable select for authenticated users on online_order_staging" ON public.online_order_staging;

-- Create new comprehensive policies that explicitly allow all columns including quantity

-- SELECT policy
CREATE POLICY "Enable select for authenticated users on online_order_staging"
ON public.online_order_staging
FOR SELECT
TO authenticated
USING (true);

-- INSERT policy - allow authenticated users to insert with any column including quantity
CREATE POLICY "Enable insert for authenticated users on online_order_staging"
ON public.online_order_staging
FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE policy - allow updating any column including quantity
CREATE POLICY "Enable update for authenticated users on online_order_staging"
ON public.online_order_staging
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- DELETE policy
CREATE POLICY "Enable delete for authenticated users on online_order_staging"
ON public.online_order_staging
FOR DELETE
TO authenticated
USING (true);

-- Verify the column exists and has correct type
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'online_order_staging'
ORDER BY ordinal_position;
