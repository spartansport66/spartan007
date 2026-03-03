-- Run this against your Postgres/Supabase database

-- Optional: create an index if you will query by urgent frequently
CREATE INDEX IF NOT EXISTS idx_orders_urgent ON public.orders (urgent);
