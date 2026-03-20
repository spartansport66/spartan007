-- CREATE A FUNCTION TO GET ALL PRODUCTS (BYPASSES RLS)
-- This function uses SECURITY DEFINER to bypass RLS policies

CREATE OR REPLACE FUNCTION get_all_products()
RETURNS TABLE (
  id UUID,
  name TEXT,
  code TEXT,
  size TEXT,
  dp NUMERIC,
  gst TEXT
) 
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    products.id,
    products.name,
    products.code,
    products.size,
    products.dp,
    products.gst
  FROM public.products
  ORDER BY products.name;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION public.get_all_products() TO anon, authenticated;
