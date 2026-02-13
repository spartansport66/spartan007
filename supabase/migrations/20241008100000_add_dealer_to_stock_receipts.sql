-- Add the dealer_id column to the stock_receipts table
ALTER TABLE public.stock_receipts
ADD COLUMN dealer_id UUID;

-- Add a foreign key constraint to link it to the dealers table
ALTER TABLE public.stock_receipts
ADD CONSTRAINT stock_receipts_dealer_id_fkey
FOREIGN KEY (dealer_id)
REFERENCES public.dealers(id)
ON DELETE SET NULL;