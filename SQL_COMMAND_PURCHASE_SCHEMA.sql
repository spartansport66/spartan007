-- 1. Create suppliers table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    contact_person text NULL,
    phone text NULL,
    email text NULL,
    address text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT suppliers_pkey PRIMARY KEY (id)
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to authenticated users" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Create purchases table
CREATE TABLE IF NOT EXISTS public.purchases (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    supplier_id uuid NULL,
    purchase_date date NOT NULL,
    total_amount numeric(10, 2) NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT purchases_pkey PRIMARY KEY (id),
    CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL,
    CONSTRAINT purchases_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to authenticated users on purchases" ON public.purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Create purchase_items table
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    purchase_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(10, 2) NOT NULL,
    total_price numeric(10, 2) NOT NULL,
    CONSTRAINT purchase_items_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id) REFERENCES public.purchases(id) ON DELETE CASCADE,
    CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT
);
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to authenticated users on purchase_items" ON public.purchase_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Create function to safely increment stock
CREATE OR REPLACE FUNCTION public.increment_stock(product_id_in uuid, quantity_in integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.products
  SET stock = stock + quantity_in
  WHERE id = product_id_in;
END;
$$;