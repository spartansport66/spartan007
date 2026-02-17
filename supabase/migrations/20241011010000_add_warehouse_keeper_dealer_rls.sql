-- Function to check if the current user is a warehouse keeper
CREATE OR REPLACE FUNCTION public.is_warehouse_keeper()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND user_type = 'warehouse_keeper'
  );
$function$;

-- Grant warehouse keepers read access to the dealers table
CREATE POLICY "Warehouse keepers can read all dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (public.is_warehouse_keeper());