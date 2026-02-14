-- 1. Create Suppliers Table
CREATE TABLE public.suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and inventory managers can manage suppliers" ON public.suppliers
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

-- 2. Create Raw Materials Table
CREATE TABLE public.raw_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    unit_of_measure TEXT, -- e.g., kg, meters, units
    current_stock NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and inventory managers can manage raw materials" ON public.raw_materials
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

-- 3. Create Purchase Orders Table
CREATE TABLE public.purchase_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number SERIAL NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_delivery_date DATE,
    status TEXT NOT NULL DEFAULT 'Draft', -- Draft, Submitted, Partially Received, Completed, Cancelled
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and inventory managers can manage purchase orders" ON public.purchase_orders
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

-- 4. Create Purchase Order Items Table
CREATE TABLE public.purchase_order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE RESTRICT,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC,
    total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and inventory managers can manage PO items" ON public.purchase_order_items
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

-- 5. Create Bill of Materials (BOM) Table
CREATE TABLE public.bill_of_materials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE, -- Finished Good
    raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE, -- Component
    quantity_required NUMERIC NOT NULL,
    UNIQUE (product_id, raw_material_id)
);
ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and inventory managers can manage BOMs" ON public.bill_of_materials
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

-- 6. Create Production Orders Table
CREATE TABLE public.production_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    production_order_number SERIAL NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity_to_produce INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Planned', -- Planned, In Progress, Completed, Cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and inventory managers can manage production orders" ON public.production_orders
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());