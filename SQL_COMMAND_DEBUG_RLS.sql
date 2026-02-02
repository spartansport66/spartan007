-- 1. Ensure RLS is enabled
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

-- 2. Drop the previous policy to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read dealers" ON public.dealers;

-- 3. Create a new policy allowing ALL roles (TO public) to SELECT
CREATE OR REPLACE POLICY "DEBUG: Allow ALL users to read dealers"
ON public.dealers
FOR SELECT
TO public
USING (TRUE);