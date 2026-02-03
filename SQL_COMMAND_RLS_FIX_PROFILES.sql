-- This script addresses a critical oversight in the RLS setup.
-- The policies on 'orders' and 'payments' need to query the 'profiles' table to check the user's role.
-- If the 'profiles' table itself has RLS enabled without a policy that allows this lookup, the query will fail and return no rows.
-- This script adds the necessary policy to the 'profiles' table.

-- 1. Ensure RLS is enabled on the profiles table. It might already be, but this is safe to run.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Drop any potentially conflicting SELECT policy that might exist.
DROP POLICY IF EXISTS "Enable read access for users to their own profile" ON public.profiles;

-- 3. Create the essential policy that allows users to read their own profile.
-- This allows the subqueries in the policies for 'orders' and 'payments' to successfully determine the user's role.
CREATE POLICY "Enable read access for users to their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);