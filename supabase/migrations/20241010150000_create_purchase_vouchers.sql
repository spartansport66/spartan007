-- 1. Create the purchase_vouchers table
CREATE TABLE public.purchase_vouchers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    voucher_number serial NOT NULL,
    purchase_order_id uuid NOT NULL,
    supplier_id uuid,
    receipt_date date NOT NULL,
    received_by uuid,
    supplier_invoice_no text,
    supplier_invoice_date date,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT purchase_vouchers_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_vouchers_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT purchase_vouchers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE SET NULL,
    CONSTRAINT purchase_vouchers_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Create the purchase_voucher_items table
CREATE TABLE public.purchase_voucher_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_voucher_id uuid NOT NULL,
    raw_material_id uuid NOT NULL,
    quantity_received numeric NOT NULL,
    unit_price numeric,
    CONSTRAINT purchase_voucher_items_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_voucher_items_purchase_voucher_id_fkey FOREIGN KEY (purchase_voucher_id) REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE,
    CONSTRAINT purchase_voucher_items_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id) ON DELETE RESTRICT
);

-- 3. Enable RLS
ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_voucher_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Admins and inventory managers can manage purchase vouchers" ON public.purchase_vouchers
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

CREATE POLICY "Admins and inventory managers can manage purchase voucher items" ON public.purchase_voucher_items
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());