-- 1. Ensure RLS is enabled
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing policies that might conflict
DROP POLICY IF EXISTS "Allow authenticated users to read dealers" ON public.dealers;
DROP POLICY IF EXISTS "DEBUG: Allow ALL users to read dealers" ON public.dealers;

-- 3. Create a new policy allowing ALL roles (TO public) to SELECT
CREATE POLICY debug_allow_all_read
ON public.dealers
FOR SELECT
TO public
USING (TRUE);