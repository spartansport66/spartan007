-- Create the sales_person_visits table
CREATE TABLE public.sales_person_visits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_person_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    dealer_id uuid REFERENCES public.dealers(id) ON DELETE CASCADE NOT NULL,
    visit_time timestamp with time zone DEFAULT now() NOT NULL,
    photo_url text,
    visit_status text,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.sales_person_visits ENABLE ROW LEVEL SECURITY;

-- Policy 1: Sales Person can INSERT their own visits
CREATE POLICY "Sales persons can insert their own visits"
ON public.sales_person_visits FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sales_person_id);

-- Policy 2: Sales Person can SELECT their own visits
CREATE POLICY "Sales persons can view their own visits"
ON public.sales_person_visits FOR SELECT
TO authenticated
USING (auth.uid() = sales_person_id);

-- Policy 3: Admins can SELECT all visits
CREATE POLICY "Admins can view all visits"
ON public.sales_person_visits FOR SELECT
TO authenticated
USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Policy 4: Admins can INSERT visits (optional, but useful for data entry)
CREATE POLICY "Admins can insert visits"
ON public.sales_person_visits FOR INSERT
TO authenticated
WITH CHECK ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Policy 5: Admins can DELETE visits
CREATE POLICY "Admins can delete visits"
ON public.sales_person_visits FOR DELETE
TO authenticated
USING ((SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);

-- Create index for faster lookups by sales person and time
CREATE INDEX idx_sales_person_visits_time ON public.sales_person_visits (sales_person_id, visit_time DESC);