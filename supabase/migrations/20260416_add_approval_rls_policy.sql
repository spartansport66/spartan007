-- Add RLS policy for Sales HOD approval on orders
-- Only Sales HOD and Admin can update approval_status

CREATE POLICY "Sales HOD and Admin can approve orders"
ON public.orders
FOR UPDATE
USING (
  (public.is_admin()) OR
  ((SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_hod')
)
WITH CHECK (
  -- Can only update approval-related fields
  (approval_status IS DISTINCT FROM (SELECT approval_status FROM public.orders WHERE id = NEW.id)) OR
  (bill_no IS DISTINCT FROM (SELECT bill_no FROM public.orders WHERE id = NEW.id)) OR
  ((SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'billing'))
);

-- Allow billing users to view approval status
CREATE POLICY "Billing users can view order approval status"
ON public.orders
FOR SELECT
USING (
  (public.is_admin()) OR
  ((SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'billing') OR
  ((SELECT user_type FROM public.profiles WHERE id = auth.uid()) = 'sales_hod')
);
