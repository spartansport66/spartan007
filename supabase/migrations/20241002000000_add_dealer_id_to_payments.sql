-- Add dealer_id column to payments table for payments not linked to a specific order (e.g., opening balance payments)
ALTER TABLE public.payments
ADD COLUMN dealer_id uuid NULL;

-- Add foreign key constraint
ALTER TABLE public.payments
ADD CONSTRAINT payments_dealer_id_fkey
FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE CASCADE;

-- Note: The application logic ensures that when order_id is NULL (balance payment), dealer_id is set.