-- Drop the existing policy to update it
DROP POLICY IF EXISTS "Allow authenticated users to read orders" ON public.orders;

-- Recreate the policy to include the 'warehouse_keeper' user type
CREATE POLICY "Allow authenticated users to read orders" ON public.orders
FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id) OR 
  (
    (SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gate_keeper'::text, 'warehouse_keeper'::text])
  )
);