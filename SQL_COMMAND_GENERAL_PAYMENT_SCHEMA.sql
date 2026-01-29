-- 1. Allow payments not tied to an order (if not already allowed)
ALTER TABLE public.payments ALTER COLUMN order_id DROP NOT NULL;

-- 2. Add dealer_id to payments table for general payments
ALTER TABLE public.payments ADD COLUMN dealer_id uuid NULL;
ALTER TABLE public.payments ADD CONSTRAINT payments_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE CASCADE;

-- 3. Update existing payments to link to their dealer_id (required for RLS and reporting)
UPDATE public.payments p
SET dealer_id = o.dealer_id
FROM public.orders o
WHERE p.order_id = o.id AND p.dealer_id IS NULL;

-- 4. Create a trigger to automatically set dealer_id on new payments linked to an order
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