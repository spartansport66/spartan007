-- Drop existing SELECT policies on the profiles table to remove redundancy
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Inventory Managers can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Gate Keepers can read all profiles" ON public.profiles;

-- Create a new, consolidated SELECT policy for the profiles table
-- This policy allows users to view their own profile, and allows admins or managers to view all profiles.
CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id) OR
  (public.is_admin()) OR
  (public.is_manager())
);