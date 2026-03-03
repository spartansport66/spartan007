-- Ensure a sequence exists and make orders.dispatch_number use it as default
BEGIN;

CREATE SEQUENCE IF NOT EXISTS public.dispatch_number_seq;

-- Set sequence current value to the max existing dispatch_number (or 0)
SELECT setval('public.dispatch_number_seq', COALESCE((SELECT MAX(dispatch_number) FROM public.orders), 0), true);

-- Make the column use the sequence by default
ALTER TABLE public.orders ALTER COLUMN dispatch_number SET DEFAULT nextval('public.dispatch_number_seq');

COMMIT;
