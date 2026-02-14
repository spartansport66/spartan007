-- Create sequence for voucher number
CREATE SEQUENCE IF NOT EXISTS public.purchase_vouchers_voucher_number_seq;

-- Create purchase_vouchers table
CREATE TABLE IF NOT EXISTS public.purchase_vouchers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_order_id uuid NULL, -- Made nullable to allow direct entries
    supplier_id uuid NOT NULL,
    voucher_number integer NOT NULL DEFAULT nextval('purchase_vouchers_voucher_number_seq'::regclass),
    receipt_date date NOT NULL,
    received_by uuid NULL,
    supplier_invoice_no text NULL,
    supplier_invoice_date date NULL,
    remarks text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT purchase_vouchers_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_vouchers_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
    CONSTRAINT purchase_vouchers_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE,
    CONSTRAINT purchase_vouchers_received_by_fkey FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and inventory managers can manage purchase vouchers" ON public.purchase_vouchers
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());

-- Create purchase_voucher_items table
CREATE TABLE IF NOT EXISTS public.purchase_voucher_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    purchase_voucher_id uuid NOT NULL,
    raw_material_id uuid NOT NULL,
    quantity_received numeric NOT NULL,
    unit_price numeric NOT NULL DEFAULT 0,
    discount_percent numeric NOT NULL DEFAULT 0,
    gst_percent numeric NOT NULL DEFAULT 0,
    total_amount numeric GENERATED ALWAYS AS ( (quantity_received * unit_price * (1 - (discount_percent / 100))) * (1 + (gst_percent / 100)) ) STORED,
    CONSTRAINT purchase_voucher_items_pkey PRIMARY KEY (id),
    CONSTRAINT purchase_voucher_items_purchase_voucher_id_fkey FOREIGN KEY (purchase_voucher_id) REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE,
    CONSTRAINT purchase_voucher_items_raw_material_id_fkey FOREIGN KEY (raw_material_id) REFERENCES public.raw_materials(id)
);

-- Enable RLS
ALTER TABLE public.purchase_voucher_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and inventory managers can manage voucher items" ON public.purchase_voucher_items
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());