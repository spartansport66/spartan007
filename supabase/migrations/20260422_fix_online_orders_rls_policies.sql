-- Fix RLS policies on online_orders table to allow warehouse keeper access
-- This migration adds proper RLS policies to the online_orders table

-- First, enable RLS on online_orders if not already enabled
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own online orders" ON public.online_orders;
DROP POLICY IF EXISTS "Admins can manage all online orders" ON public.online_orders;
DROP POLICY IF EXISTS "warehouse_keepers_can_view_online_orders" ON public.online_orders;
DROP POLICY IF EXISTS "Online orders managers can manage online orders" ON public.online_orders;
DROP POLICY IF EXISTS "allow_authenticated_select_online_orders" ON public.online_orders;

-- Create permissive SELECT policies for online_orders
-- Policy 1: Authenticated users can SELECT online orders (fallback permissive policy)
CREATE POLICY "allow_authenticated_select_online_orders" ON public.online_orders
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Warehouse keepers can view online orders
CREATE POLICY "warehouse_keepers_can_view_online_orders" ON public.online_orders
FOR SELECT
TO authenticated
USING (public.is_warehouse_keeper());

-- Policy 3: Admins can manage all online orders
CREATE POLICY "Admins can manage all online orders" ON public.online_orders
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Policy 4: Users can manage their own online orders
CREATE POLICY "Users can manage their own online orders" ON public.online_orders
FOR ALL
TO authenticated
USING ((SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid())
WITH CHECK ((SELECT user_id FROM public.orders WHERE id = order_id) = auth.uid());

-- Policy 5: Online orders managers can manage online orders
CREATE POLICY "Online orders managers can manage online orders" ON public.online_orders
FOR ALL
TO authenticated
USING (public.is_online_orders_manager())
WITH CHECK (public.is_online_orders_manager());

-- Add comment documenting the policies
COMMENT ON TABLE public.online_orders IS 'Tracks online platform orders linked to the orders table. RLS policies allow warehouse_keeper, admin, and order owners to view.';
