-- 1. Add the paid_amount column to the orders table
ALTER TABLE orders
ADD COLUMN paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00;

-- 2. Create the payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    dealer_id UUID REFERENCES dealers(id) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    payment_method TEXT NOT NULL,
    reference_number TEXT,
    unallocated_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- RLS: Allow authenticated users to insert payments for their assigned dealers (or any dealer if admin)
CREATE POLICY "Sales persons can insert payments for assigned dealers" ON public.payments FOR INSERT TO authenticated WITH CHECK (
    auth.uid() IN (SELECT sales_person_id FROM dealer_sales_persons WHERE dealer_id = dealer_id)
    OR (SELECT is_admin FROM profiles WHERE id = auth.uid())
);
-- RLS: Allow authenticated users to read payments for their assigned dealers or if they are admin/manager
CREATE POLICY "Users can read payments for assigned dealers or if admin/manager" ON public.payments FOR SELECT TO authenticated USING (
    auth.uid() IN (SELECT sales_person_id FROM dealer_sales_persons WHERE dealer_id = dealer_id)
    OR (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager', 'inventory_manager')
);


-- 3. Create the payment_allocations table
CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id UUID REFERENCES payments(id) NOT NULL,
    order_id UUID REFERENCES orders(id) NOT NULL,
    allocated_amount NUMERIC(10, 2) NOT NULL,
    UNIQUE (payment_id, order_id)
);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
-- RLS: Allow authenticated users to read allocations if they can read the associated payment/order
CREATE POLICY "Users can read payment allocations" ON public.payment_allocations FOR SELECT TO authenticated USING (
    payment_id IN (SELECT id FROM payments)
    AND order_id IN (SELECT id FROM orders)
);


-- 4. Create the RPC function to process the payment
CREATE OR REPLACE FUNCTION process_dealer_payment(
    p_dealer_id UUID,
    p_total_amount NUMERIC,
    p_payment_method TEXT,
    p_reference_number TEXT,
    p_allocations JSONB
)
RETURNS UUID AS $$
DECLARE
    v_payment_id UUID;
    v_allocated_total NUMERIC := 0;
    v_unallocated_amount NUMERIC;
    allocation_item JSONB;
    v_order_id UUID;
    v_allocated_amount NUMERIC;
BEGIN
    -- 1. Calculate total allocated amount
    SELECT COALESCE(SUM((elem->>'allocated_amount')::NUMERIC), 0)
    INTO v_allocated_total
    FROM jsonb_array_elements(p_allocations) AS elem;

    -- 2. Calculate unallocated (advance) amount
    v_unallocated_amount := p_total_amount - v_allocated_total;

    -- 3. Insert the main payment record
    INSERT INTO payments (dealer_id, total_amount, payment_method, reference_number, unallocated_amount, created_by)
    VALUES (p_dealer_id, p_total_amount, p_payment_method, p_reference_number, v_unallocated_amount, auth.uid())
    RETURNING id INTO v_payment_id;

    -- 4. Process allocations and update orders
    FOR allocation_item IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
        v_order_id := (allocation_item->>'order_id')::UUID;
        v_allocated_amount := (allocation_item->>'allocated_amount')::NUMERIC;

        IF v_allocated_amount > 0 THEN
            -- Insert allocation record
            INSERT INTO payment_allocations (payment_id, order_id, allocated_amount)
            VALUES (v_payment_id, v_order_id, v_allocated_amount);

            -- Update the paid_amount on the order
            UPDATE orders
            SET paid_amount = paid_amount + v_allocated_amount
            WHERE id = v_order_id;
        END IF;
    END LOOP;

    -- 5. Return the new payment ID
    RETURN v_payment_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;