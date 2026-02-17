-- 1. Create the categories table
CREATE TABLE public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 3. Add RLS policies
CREATE POLICY "Allow read access to authenticated users" ON public.categories
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for inventory managers and admins" ON public.categories
FOR INSERT TO authenticated WITH CHECK (public.has_inventory_access());

CREATE POLICY "Allow update for inventory managers and admins" ON public.categories
FOR UPDATE TO authenticated USING (public.has_inventory_access());

CREATE POLICY "Allow delete for inventory managers and admins" ON public.categories
FOR DELETE TO authenticated USING (public.has_inventory_access());

-- 4. Add category_id column to products table
ALTER TABLE public.products
ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;