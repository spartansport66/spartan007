-- Add dealer_name column to promotional_orders table
ALTER TABLE public.promotional_orders
ADD COLUMN IF NOT EXISTS dealer_name VARCHAR(255);

-- Backfill existing orders with dealer names from the dealers table
UPDATE public.promotional_orders po
SET dealer_name = d.name
FROM public.dealers d
WHERE po.dealer_id = d.id AND po.dealer_name IS NULL;

-- Create or replace function to automatically set dealer_name on insert/update
CREATE OR REPLACE FUNCTION public.set_promotional_order_dealer_name()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.dealer_id IS NOT NULL THEN
    SELECT name INTO NEW.dealer_name
    FROM public.dealers
    WHERE id = NEW.dealer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_set_promotional_order_dealer_name ON public.promotional_orders;

-- Create trigger for inserts
CREATE TRIGGER trigger_set_promotional_order_dealer_name
BEFORE INSERT OR UPDATE ON public.promotional_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_promotional_order_dealer_name();
