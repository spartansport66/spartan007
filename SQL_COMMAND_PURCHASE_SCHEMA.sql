-- This script sets up the database tables required for purchase management.

-- 1. Create a table for suppliers
CREATE TABLE public.suppliers (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    contact_person text NULL,
    phone text NULL,
    email text NULL,
    address text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT suppliers_pkey PRIMARY KEY (id),
    CONSTRAINT suppliers_name_key UNIQUE (name)
);

-- 2. Create a table for purchases (the main record of a purchase event)
CREATE TABLE public.purchases (
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

-- 3. Create a table for purchase items (the individual products within a purchase)
CREATE TABLE public.purchase_items (
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

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Allow Admins and Inventory Managers to manage everything)
CREATE POLICY "Allow all access to admins and inventory managers on suppliers" ON public.suppliers FOR ALL USING ( (get_my_claim('user_type'::text)) = '"admin"'::jsonb OR (get_my_claim('user_type'::text)) = '"inventory_manager"'::jsonb );
CREATE POLICY "Allow all access to admins and inventory managers on purchases" ON public.purchases FOR ALL USING ( (get_my_claim('user_type'::text)) = '"admin"'::jsonb OR (get_my_claim('user_type'::text)) = '"inventory_manager"'::jsonb );
CREATE POLICY "Allow all access to admins and inventory managers on purchase_items" ON public.purchase_items FOR ALL USING ( (get_my_claim('user_type'::text)) = '"admin"'::jsonb OR (get_my_claim('user_type'::text)) = '"inventory_manager"'::jsonb );