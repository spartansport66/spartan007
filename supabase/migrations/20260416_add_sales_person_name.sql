-- Add RLS policy for sales_person_name column on orders table
-- (Column already exists, this migration just ensures RLS policy is set)

-- Add RLS policy to allow billing users and admins to update sales_person_name
DROP POLICY IF EXISTS "Billing users and admins can UPDATE sales_person_name" ON public.orders;
CREATE POLICY "Billing users and admins can UPDATE sales_person_name"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
)
WITH CHECK (
  (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('billing', 'admin', 'super_admin')
);
