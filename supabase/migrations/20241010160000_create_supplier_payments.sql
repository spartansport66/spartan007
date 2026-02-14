-- 1. Create the supplier_payments table
CREATE TABLE public.supplier_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    supplier_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_date date NOT NULL,
    payment_method text NOT NULL,
    reference_no text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    CONSTRAINT supplier_payments_pkey PRIMARY KEY (id),
    CONSTRAINT supplier_payments_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE,
    CONSTRAINT supplier_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable RLS
ALTER TABLE public.supplier_payments ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Admins and inventory managers can manage supplier payments" ON public.supplier_payments
FOR ALL USING (public.has_inventory_access()) WITH CHECK (public.has_inventory_access());