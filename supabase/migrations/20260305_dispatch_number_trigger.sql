-- Prevent dispatch_number from being generated until an order is actually dispatched

-- Drop the default to avoid accidental sequence increments on updates/inserts
ALTER TABLE public.orders ALTER COLUMN dispatch_number DROP DEFAULT;

-- Function to set dispatch_number only when order is marked as dispatched (or a dispatch date is provided)
CREATE OR REPLACE FUNCTION public.orders_set_dispatch_number()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign a dispatch number when the order is being marked as dispatched
  IF (TG_OP = 'INSERT' AND NEW.dispatched = TRUE)
     OR (TG_OP = 'UPDATE' AND NEW.dispatched = TRUE 
         AND (OLD.dispatched IS DISTINCT FROM NEW.dispatched OR OLD.dispatch_date IS DISTINCT FROM NEW.dispatch_date)) THEN
    IF NEW.dispatch_number IS NULL THEN
      NEW.dispatch_number := nextval('public.dispatch_number_seq');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper RPC to explicitly fetch the next dispatch number when needed
CREATE OR REPLACE FUNCTION public.get_next_dispatch_number()
RETURNS BIGINT LANGUAGE SQL AS $$
  SELECT nextval('public.dispatch_number_seq');
$$;

-- Trigger that fires before insert or update
DROP TRIGGER IF EXISTS orders_dispatch_number_trigger ON public.orders;
CREATE TRIGGER orders_dispatch_number_trigger
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.orders_set_dispatch_number();
