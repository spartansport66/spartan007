-- Add the order_id column to the stock_receipts table
ALTER TABLE public.stock_receipts
ADD COLUMN order_id UUID;

-- Add a foreign key constraint to link it to the orders table
ALTER TABLE public.stock_receipts
ADD CONSTRAINT stock_receipts_order_id_fkey
FOREIGN KEY (order_id)
REFERENCES public.orders(id)
ON DELETE SET NULL; -- If an order is deleted, we keep the return record but unlink it.