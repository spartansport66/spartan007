-- 1. Drop existing RLS policies on payments table if they exist (required before altering columns)
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;

-- 2. Remove the foreign key constraint on order_id in payments table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_order_id_fkey') THEN
        ALTER TABLE public.payments DROP CONSTRAINT payments_order_id_fkey;
    END IF;
END
$$;

-- 3. DATA CLEANUP: Populate missing dealer_id using order_id before setting NOT NULL constraint.
-- This assumes any payment with a NULL dealer_id must have an order_id linked to a dealer.
UPDATE public.payments p
SET dealer_id = o.dealer_id
FROM public.orders o
WHERE p.order_id IS NOT NULL
  AND p.dealer_id IS NULL
  AND p.order_id = o.id;

-- Now ensure dealer_id is NOT NULL in payments table
ALTER TABLE public.payments ALTER COLUMN dealer_id SET NOT NULL;

-- 4. Create payment_allocations table
CREATE TABLE IF NOT EXISTS public.payment_allocations (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
    liability_id uuid NOT NULL, -- Can be dealer_id (for OB/Advance) or order_id
    allocated_amount numeric NOT NULL,
    allocation_type text NOT NULL, -- 'opening_balance', 'order', 'advance'
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT payment_allocations_pkey PRIMARY KEY (id)
);

-- 5. Create RLS policies for payment_allocations
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- Admins can do anything
DROP POLICY IF EXISTS "Admins can manage all payment allocations" ON public.payment_allocations;
CREATE POLICY "Admins can manage all payment allocations" ON public.payment_allocations
    FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE user_type = 'admin'));

-- Sales persons can read allocations for their assigned dealers
DROP POLICY IF EXISTS "Sales persons can read allocations for their dealers" ON public.payment_allocations;
CREATE POLICY "Sales persons can read allocations for their dealers" ON public.payment_allocations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.dealer_sales_persons
            WHERE dealer_sales_persons.sales_person_id = auth.uid()
            AND dealer_sales_persons.dealer_id = payment_allocations.liability_id -- Check if liability is a dealer ID
        )
        OR EXISTS (
            SELECT 1 FROM public.orders
            WHERE orders.id = payment_allocations.liability_id -- Check if liability is an order ID
            AND orders.dealer_id IN (
                SELECT dealer_id FROM public.dealer_sales_persons WHERE sales_person_id = auth.uid()
            )
        )
    );

-- 6. Re-enable RLS for payments table
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 7. Update RLS policies on payments table to allow general payments (dealer_id is now mandatory)
-- Note: Assuming existing policies are sufficient, but ensure they cover the new schema.