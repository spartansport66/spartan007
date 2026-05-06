-- Create helper functions for profile RLS checks
-- These are used by profiles SELECT policies to allow admin/manager/billing access.

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
