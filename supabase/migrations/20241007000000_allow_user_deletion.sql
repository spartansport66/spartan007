-- Make user_id columns nullable to allow setting them to NULL on user deletion
ALTER TABLE public.dealers ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.products ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Update foreign key constraints to SET NULL on delete for related tables

-- For dealers
ALTER TABLE public.dealers DROP CONSTRAINT IF EXISTS dealers_user_id_fkey;
ALTER TABLE public.dealers
ADD CONSTRAINT dealers_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For products
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE public.products
ADD CONSTRAINT products_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For payments
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_recorded_by_fkey;
ALTER TABLE public.payments
ADD CONSTRAINT payments_recorded_by_fkey
FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For stock_receipts
ALTER TABLE public.stock_receipts DROP CONSTRAINT IF EXISTS stock_receipts_received_by_fkey;
ALTER TABLE public.stock_receipts
ADD CONSTRAINT stock_receipts_received_by_fkey
FOREIGN KEY (received_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For combo_offers
ALTER TABLE public.combo_offers DROP CONSTRAINT IF EXISTS combo_offers_created_by_fkey;
ALTER TABLE public.combo_offers
ADD CONSTRAINT combo_offers_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For production_alerts
ALTER TABLE public.production_alerts DROP CONSTRAINT IF EXISTS production_alerts_created_by_fkey;
ALTER TABLE public.production_alerts
ADD CONSTRAINT production_alerts_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- For whatsapp_sent_logs
ALTER TABLE public.whatsapp_sent_logs DROP CONSTRAINT IF EXISTS whatsapp_sent_logs_sent_by_fkey;
ALTER TABLE public.whatsapp_sent_logs
ADD CONSTRAINT whatsapp_sent_logs_sent_by_fkey
FOREIGN KEY (sent_by) REFERENCES auth.users(id) ON DELETE SET NULL;