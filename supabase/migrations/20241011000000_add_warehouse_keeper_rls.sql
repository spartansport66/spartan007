-- 1. Create a helper function to check for warehouse_keeper role
CREATE OR REPLACE FUNCTION public.is_warehouse_keeper()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'warehouse_keeper'
  );
$$;

-- 2. Update orders SELECT policy to include warehouse_keeper
-- We drop the existing policy and recreate it with the new role included
DROP POLICY IF EXISTS "Allow authenticated users to read orders" ON public.orders;
CREATE POLICY "Allow authenticated users to read orders" ON public.orders
FOR SELECT TO authenticated USING (
  (auth.uid() = user_id) OR 
  ((SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'gate_keeper'::text, 'warehouse_keeper'::text, 'manager'::text]))
);

-- 3. Add UPDATE policy for warehouse_keeper on orders (to allow dispatching)
CREATE POLICY "Warehouse keepers can update orders for dispatch" ON public.orders
FOR UPDATE TO authenticated 
USING (is_warehouse_keeper())
WITH CHECK (is_warehouse_keeper());

-- 4. Update dealers SELECT policy to include warehouse_keeper
DROP POLICY IF EXISTS "Allow managers to read all dealers" ON public.dealers;
CREATE POLICY "Allow managers to read all dealers" ON public.dealers
FOR SELECT TO authenticated USING (
  ((SELECT profiles.user_type FROM profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['admin'::text, 'manager'::text, 'warehouse_keeper'::text]))
);

-- 5. Update profiles SELECT policy to allow warehouse_keeper to see salesperson names
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles
FOR SELECT TO authenticated USING (
  (auth.uid() = id) OR is_admin() OR is_manager() OR is_warehouse_keeper() OR is_gate_keeper()
);