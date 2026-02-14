-- Add columns to store supplier invoice details on the purchase order
ALTER TABLE public.purchase_orders
ADD COLUMN supplier_invoice_no TEXT,
ADD COLUMN supplier_invoice_date DATE;