-- Add missing columns to eway_bills table

ALTER TABLE public.eway_bills
ADD COLUMN IF NOT EXISTS eway_bill_no text,
ADD COLUMN IF NOT EXISTS eway_bill_date date,
ADD COLUMN IF NOT EXISTS valid_upto date,
ADD COLUMN IF NOT EXISTS grand_total numeric,
ADD COLUMN IF NOT EXISTS dealer_name text,
ADD COLUMN IF NOT EXISTS dealer_gst text,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS company_gst text,
ADD COLUMN IF NOT EXISTS sno integer,
ADD COLUMN IF NOT EXISTS total_items integer DEFAULT 0;

-- Add missing columns to eway_bill_settings table

ALTER TABLE public.eway_bill_settings
ADD COLUMN IF NOT EXISTS sender_pincode text,
ADD COLUMN IF NOT EXISTS recipient_pincode text,
ADD COLUMN IF NOT EXISTS supply_type text,
ADD COLUMN IF NOT EXISTS transport_distance text,
ADD COLUMN IF NOT EXISTS vehicle_type text;

-- Create indexes for new columns

CREATE INDEX IF NOT EXISTS idx_eway_bills_eway_bill_no ON public.eway_bills (eway_bill_no);
CREATE INDEX IF NOT EXISTS idx_eway_bills_eway_bill_date ON public.eway_bills (eway_bill_date);
CREATE INDEX IF NOT EXISTS idx_eway_bills_valid_upto ON public.eway_bills (valid_upto);
CREATE INDEX IF NOT EXISTS idx_eway_bills_sno ON public.eway_bills (sno);
CREATE INDEX IF NOT EXISTS idx_eway_bills_total_items ON public.eway_bills (total_items);
