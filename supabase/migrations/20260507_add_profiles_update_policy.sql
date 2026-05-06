-- Allow authenticated users to update their own profile and admins to update any profile

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can update their own profile" ON public.profiles;
CREATE POLICY "Authenticated users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING ((SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true)
WITH CHECK ((SELECT COALESCE(is_admin, false) FROM public.profiles WHERE id = auth.uid()) = true);
