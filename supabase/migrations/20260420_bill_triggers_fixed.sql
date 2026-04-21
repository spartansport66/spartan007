-- Drop existing functions and triggers first
DROP TRIGGER IF EXISTS auto_bill_number_on_spartan_insert ON public.spartan;
DROP TRIGGER IF EXISTS auto_bill_number_on_fightor_insert ON public.fightor;
DROP FUNCTION IF EXISTS public.auto_generate_bill_number_spartan();
DROP FUNCTION IF EXISTS public.auto_generate_bill_number_fightor();

-- 1. Function to generate bill number for spartan table
CREATE FUNCTION public.auto_generate_bill_number_spartan()
RETURNS TRIGGER AS $$
DECLARE
  v_last_bill_number TEXT;
  v_last_sequence INT;
  v_next_sequence INT;
  v_prefix TEXT;
  v_separator TEXT;
BEGIN
  IF NEW.bill_number IS NULL AND NEW.bill_series_id IS NOT NULL THEN
    -- Get prefix and separator
    SELECT series_prefix, series_separator INTO v_prefix, v_separator
    FROM public.bill_series 
    WHERE id = NEW.bill_series_id;
    
    -- Get last bill
    SELECT MAX(bill_number) INTO v_last_bill_number
    FROM public.spartan
    WHERE bill_series_id = NEW.bill_series_id;
    
    -- Calculate next sequence
    IF v_last_bill_number IS NULL THEN
      v_next_sequence := 1;
    ELSE
      v_last_sequence := CAST(SPLIT_PART(v_last_bill_number, '/', 3) AS INT);
      v_next_sequence := v_last_sequence + 1;
    END IF;
    
    -- Set bill number
    NEW.bill_number := v_prefix || COALESCE(v_separator, '/') || v_next_sequence;
    NEW.bill_date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Function to generate bill number for fightor table
CREATE FUNCTION public.auto_generate_bill_number_fightor()
RETURNS TRIGGER AS $$
DECLARE
  v_last_bill_number TEXT;
  v_last_sequence INT;
  v_next_sequence INT;
  v_prefix TEXT;
  v_separator TEXT;
BEGIN
  IF NEW.bill_number IS NULL AND NEW.bill_series_id IS NOT NULL THEN
    -- Get prefix and separator
    SELECT series_prefix, series_separator INTO v_prefix, v_separator
    FROM public.bill_series 
    WHERE id = NEW.bill_series_id;
    
    -- Get last bill
    SELECT MAX(bill_number) INTO v_last_bill_number
    FROM public.fightor
    WHERE bill_series_id = NEW.bill_series_id;
    
    -- Calculate next sequence
    IF v_last_bill_number IS NULL THEN
      v_next_sequence := 1;
    ELSE
      v_last_sequence := CAST(SPLIT_PART(v_last_bill_number, '/', 3) AS INT);
      v_next_sequence := v_last_sequence + 1;
    END IF;
    
    -- Set bill number
    NEW.bill_number := v_prefix || COALESCE(v_separator, '/') || v_next_sequence;
    NEW.bill_date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on spartan table
CREATE TRIGGER auto_bill_number_on_spartan_insert
BEFORE INSERT ON public.spartan
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_bill_number_spartan();

-- 4. Create trigger on fightor table
CREATE TRIGGER auto_bill_number_on_fightor_insert
BEFORE INSERT ON public.fightor
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_bill_number_fightor();
