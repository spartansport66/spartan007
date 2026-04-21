-- Add billing user type access to profiles table
-- Create a helper function for billing user check (avoiding recursion)

-- First, create the is_billing function if it doesn't exist
CREATE OR REPLACE FUNCTION public.is_billing()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Now update the RLS policy to include billing users (without subqueries to avoid recursion)
DROP POLICY IF EXISTS "All roles can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.uid() = id) OR
  (public.is_admin()) OR
  (public.is_manager()) OR
  (public.is_billing())
);
