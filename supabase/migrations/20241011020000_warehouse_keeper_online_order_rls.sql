-- Grant SELECT access on online_order_details to warehouse keepers
CREATE POLICY "warehouse_keepers_can_view_online_order_details"
ON public.online_order_details
FOR SELECT
TO authenticated
USING (public.is_warehouse_keeper());

-- Grant SELECT access on profiles to warehouse keepers (to see sales person names)
CREATE POLICY "warehouse_keepers_can_view_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_warehouse_keeper());