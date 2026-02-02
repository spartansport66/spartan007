-- 1. Allow payments not tied to an order (if not already allowed)
ALTER TABLE public.payments ALTER COLUMN order_id DROP NOT NULL;

-- 2. Add dealer_id column if it doesn't exist (skipping based on your error, but keeping the logic safe)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'payments' AND column_name = 'dealer_id') THEN
        ALTER TABLE public.payments ADD COLUMN dealer_id uuid NULL;
    END IF;
END
$$;

-- 3. Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_dealer_id_fkey') THEN
        ALTER TABLE public.payments ADD CONSTRAINT payments_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE CASCADE;
    END IF;
END
$$;

-- 4. Update existing payments to link to their dealer_id (required for RLS and reporting)
UPDATE public.payments p
SET dealer_id = o.dealer_id
FROM public.orders o
WHERE p.order_id = o.id AND p.dealer_id IS NULL;

-- 5. Create or replace a trigger to automatically set dealer_id on new payments linked to an order
CREATE OR REPLACE FUNCTION public.set_dealer_id_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_id IS NOT NULL THEN
    SELECT dealer_id INTO NEW.dealer_id FROM public.orders WHERE id = NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER set_dealer_id_on_payment_trigger
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_dealer_id_on_payment();