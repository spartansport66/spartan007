-- Fix infinite recursion in profiles RLS policy
-- Root cause: Using subqueries within USING clause of the SAME table causes recursion
-- Solution: Use the existing working policy pattern from before

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "All roles can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

-- Restore the original working policy that doesn't cause recursion
-- This allows users to view their own profile, admins, and managers to view all
CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id) OR
  (public.is_admin()) OR
  (public.is_manager())
);

-- For accounts users to lookup sales person names, we'll need a different approach
-- We can either:
-- 1. Create a service role function that doesn't need RLS
-- 2. Or handle the lookup in the application with special handling
-- For now, keep this policy working for admin/manager/self views
