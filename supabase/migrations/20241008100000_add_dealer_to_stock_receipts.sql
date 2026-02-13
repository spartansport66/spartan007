-- Add dealer_id column to stock_receipts table
ALTER TABLE public.stock_receipts
ADD COLUMN dealer_id UUID REFERENCES public.dealers(id) ON DELETE SET NULL;