-- Make order_id column in payments table nullable
ALTER TABLE public.payments
ALTER COLUMN order_id DROP NOT NULL;

-- Note: We rely on application logic to ensure either order_id OR dealer_id is set.