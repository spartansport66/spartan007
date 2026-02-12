-- Function to update order payment status when a payment is completed
CREATE OR REPLACE FUNCTION public.update_order_payment_status_on_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  order_total NUMERIC;
  total_paid NUMERIC;
  new_payment_status TEXT;
BEGIN
  -- Only run for completed payments associated with an order
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status <> OLD.status)) AND NEW.status = 'completed' AND NEW.order_id IS NOT NULL THEN
    
    -- Get the total amount of the order
    SELECT total_amount INTO order_total
    FROM public.orders
    WHERE id = NEW.order_id;

    -- Calculate the sum of all completed payments for this order
    SELECT SUM(p.amount) INTO total_paid
    FROM public.payments p
    WHERE p.order_id = NEW.order_id AND p.status = 'completed';

    -- Determine the new payment status
    IF total_paid >= order_total THEN
      new_payment_status := 'paid';
    ELSE
      new_payment_status := 'pending';
    END IF;

    -- Update the order's payment status
    UPDATE public.orders
    SET payment_status = new_payment_status
    WHERE id = NEW.order_id;

  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger the function after a payment is inserted or updated
DROP TRIGGER IF EXISTS on_payment_completed ON public.payments;
CREATE TRIGGER on_payment_completed
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_order_payment_status_on_payment();