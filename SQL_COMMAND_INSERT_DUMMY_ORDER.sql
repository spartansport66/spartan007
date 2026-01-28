-- Insert a dummy order record with a known ID (000...000)
-- This record is used to satisfy the foreign key constraint for general balance payments
-- that are not tied to a specific sales order.
INSERT INTO public.orders (id, order_number, dealer_id, user_id, total_amount, status, payment_status)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    0, -- Use 0 or a unique number outside your auto-increment range
    '00000000-0000-0000-0000-000000000000', -- Assuming a dummy dealer ID also exists or is allowed
    '00000000-0000-0000-0000-000000000000', -- Assuming a dummy user ID also exists or is allowed
    0, 
    'dummy', 
    'paid'
)
ON CONFLICT (id) DO NOTHING;