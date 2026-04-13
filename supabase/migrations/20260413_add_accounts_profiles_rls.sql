-- Add accounts user type access to profiles table
-- This allows accounts users to view all profiles and resolve sales person names

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Create a new policy that includes accounts users
CREATE POLICY "All roles can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id) OR
  (public.is_admin()) OR
  (public.is_manager()) OR
  ((SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'accounts')
);
