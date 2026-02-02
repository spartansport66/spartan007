-- Create Raw Materials Table
CREATE TABLE IF NOT EXISTS public.raw_materials (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    unit_of_measure text NOT NULL,
    current_stock numeric NOT NULL DEFAULT 0,
    min_stock_level numeric NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT raw_materials_pkey PRIMARY KEY (id)
);

-- Create Suppliers Table
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    contact_person text NULL,
    phone text NULL,
    email text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT suppliers_pkey PRIMARY KEY (id),
    CONSTRAINT suppliers_name_unique UNIQUE (name)
);

-- Create Purchase Order Number Sequence
CREATE SEQUENCE IF NOT EXISTS public.po_number_seq START 1000;

-- Create Purchase Orders Table
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    po_number bigint NOT NULL DEFAULT nextval('public.po_number_seq'),
    supplier_id uuid NOT NULL,
    order_date timestamp with time zone NOT NULL DEFAULT now(),
    expected_delivery_date date NULL,
    status text NOT NULL DEFAULT 'draft',
    total_amount numeric NOT NULL DEFAULT 0,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT purchase_orders_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number),
    CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE RESTRICT
);

-- Create Purchase Order Items Table
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    purchase_order_id uuid NOT NULL,
    raw_material_id uuid NOT NULL,
    quantity_ordered numeric NOT NULL,
    unit_price numeric NOT NULL,
    total_price numeric NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT purchase_order_items_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id) ON DELETE RESTRICT
);

-- Enable RLS for new tables
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Assuming Admin/Manager/Inventory Manager roles need full access)
-- Raw Materials
CREATE POLICY "Allow full access to raw_materials for Admin/Manager/Inventory" ON public.raw_materials
    FOR ALL TO authenticated USING (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    ) WITH CHECK (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    );

-- Suppliers
CREATE POLICY "Allow full access to suppliers for Admin/Manager/Inventory" ON public.suppliers
    FOR ALL TO authenticated USING (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    ) WITH CHECK (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    );

-- Purchase Orders
CREATE POLICY "Allow full access to purchase_orders for Admin/Manager/Inventory" ON public.purchase_orders
    FOR ALL TO authenticated USING (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    ) WITH CHECK (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    );

-- Purchase Order Items
CREATE POLICY "Allow full access to purchase_order_items for Admin/Manager/Inventory" ON public.purchase_order_items
    FOR ALL TO authenticated USING (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    ) WITH CHECK (
        (SELECT user_type FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
    );