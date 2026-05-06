-- Ensure TA exists on profiles and fix profile SELECT RLS policy for admin/manager/billing/accounts users

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ta numeric DEFAULT 0;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(is_admin, FALSE) FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) = 'manager';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_billing()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) = 'billing';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_accounts()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT COALESCE(user_type, '') FROM public.profiles WHERE id = auth.uid()) = 'accounts';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "All roles can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = id OR
  public.is_admin() OR
  public.is_manager() OR
  public.is_billing() OR
  public.is_accounts()
);
