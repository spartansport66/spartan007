-- Enable RLS on the tables
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dealer_sales_persons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated users to read products" ON public.products;
DROP POLICY IF EXISTS "Allow sales person to see assigned dealers" ON public.dealers;
DROP POLICY IF EXISTS "Allow sales person to read their own assignments" ON public.dealer_sales_persons;

-- Create policies
CREATE POLICY "Allow authenticated users to read products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow sales person to see assigned dealers"
ON public.dealers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM dealer_sales_persons
    WHERE dealer_sales_persons.dealer_id = dealers.id
    AND dealer_sales_persons.sales_person_id = auth.uid()
  )
);

CREATE POLICY "Allow sales person to read their own assignments"
ON public.dealer_sales_persons
FOR SELECT
TO authenticated
USING (
  auth.uid() = sales_person_id
);