-- AUTO BILL NUMBER GENERATION TRIGGER
CREATE OR REPLACE FUNCTION auto_generate_bill_number()
RETURNS TRIGGER AS $$
DECLARE
  v_prefix TEXT;
  v_separator TEXT;
  v_sequence INT;
  v_bill_number TEXT;
BEGIN
  -- Only generate if bill_number is NULL and we have a bill_series_id
  IF NEW.bill_number IS NULL AND NEW.bill_series_id IS NOT NULL THEN
    -- Lock and increment sequence, get the old value
    UPDATE public.bill_series
    SET current_sequence_number = current_sequence_number + 1,
        updated_at = NOW()
    WHERE id = NEW.bill_series_id
    RETURNING series_prefix, series_separator, (current_sequence_number - 1)
    INTO v_prefix, v_separator, v_sequence;

    -- Build bill number if we got data
    IF v_prefix IS NOT NULL THEN
      v_bill_number := v_prefix || COALESCE(v_separator, '') || v_sequence::TEXT;
      NEW.bill_number := v_bill_number;
      NEW.bill_date := COALESCE(NEW.bill_date, CURRENT_DATE);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_bill_number_on_invoice_insert ON public.invoices;

CREATE TRIGGER auto_bill_number_on_invoice_insert
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION auto_generate_bill_number();
