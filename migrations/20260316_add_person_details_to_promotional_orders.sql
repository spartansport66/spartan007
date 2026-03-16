-- Add person details columns to promotional_orders table
ALTER TABLE public.promotional_orders
ADD COLUMN IF NOT EXISTS person_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS person_address TEXT,
ADD COLUMN IF NOT EXISTS person_contact_no VARCHAR(20);
