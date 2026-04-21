-- Add UPDATE RLS policy for billing users to modify dealer GST number
-- This is required for billing users to edit GST numbers

DROP POLICY IF EXISTS "Billing users can update dealer GST" ON public.dealers;

CREATE POLICY "Billing users can update dealer GST"
ON public.dealers
FOR UPDATE
TO authenticated
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing'
  OR (SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "Billing users can update dealer GST" ON public.dealers IS 'Allows billing and admin users to update dealer GST information';
