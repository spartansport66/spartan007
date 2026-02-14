-- Make purchase_order_id nullable in purchase_vouchers to allow direct entries
ALTER TABLE public.purchase_vouchers
ALTER COLUMN purchase_order_id DROP NOT NULL;

-- Add discount, GST, and total columns to purchase_voucher_items
ALTER TABLE public.purchase_voucher_items
ADD COLUMN discount_percent numeric NOT NULL DEFAULT 0,
ADD COLUMN gst_percent numeric NOT NULL DEFAULT 0,
ADD COLUMN total_amount numeric GENERATED ALWAYS AS ( (quantity_received * unit_price * (1 - (discount_percent / 100))) * (1 + (gst_percent / 100)) ) STORED;