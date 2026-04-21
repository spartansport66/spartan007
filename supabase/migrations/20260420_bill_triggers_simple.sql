-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS auto_bill_number_on_spartan_insert ON public.spartan CASCADE;
DROP TRIGGER IF EXISTS auto_bill_number_on_fightor_insert ON public.fightor CASCADE;
DROP FUNCTION IF EXISTS public.auto_generate_bill_number_spartan() CASCADE;
DROP FUNCTION IF EXISTS public.auto_generate_bill_number_fightor() CASCADE;

-- 1. Simpler function for spartan table
CREATE FUNCTION public.auto_generate_bill_number_spartan()
RETURNS TRIGGER AS $$
DECLARE
  last_bill TEXT;
  last_seq INT;
  next_seq INT;
  prefix_val TEXT;
  sep_val TEXT;
BEGIN
  IF NEW.bill_number IS NULL AND NEW.bill_series_id IS NOT NULL THEN
    -- Get series info
    prefix_val := (SELECT COALESCE(series_prefix, '') FROM public.bill_series WHERE id = NEW.bill_series_id);
    sep_val := (SELECT COALESCE(series_separator, '/') FROM public.bill_series WHERE id = NEW.bill_series_id);
    
    -- Get last bill
    last_bill := (SELECT MAX(bill_number) FROM public.spartan WHERE bill_series_id = NEW.bill_series_id);
    
    -- Calculate sequence
    IF last_bill IS NULL THEN
      next_seq := 1;
    ELSE
      last_seq := CAST(SPLIT_PART(last_bill, '/', 3) AS INTEGER);
      next_seq := last_seq + 1;
    END IF;
    
    -- Set bill number
    NEW.bill_number := prefix_val || sep_val || CAST(next_seq AS TEXT);
    NEW.bill_date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Simpler function for fightor table
CREATE FUNCTION public.auto_generate_bill_number_fightor()
RETURNS TRIGGER AS $$
DECLARE
  last_bill TEXT;
  last_seq INT;
  next_seq INT;
  prefix_val TEXT;
  sep_val TEXT;
BEGIN
  IF NEW.bill_number IS NULL AND NEW.bill_series_id IS NOT NULL THEN
    -- Get series info
    prefix_val := (SELECT COALESCE(series_prefix, '') FROM public.bill_series WHERE id = NEW.bill_series_id);
    sep_val := (SELECT COALESCE(series_separator, '/') FROM public.bill_series WHERE id = NEW.bill_series_id);
    
    -- Get last bill
    last_bill := (SELECT MAX(bill_number) FROM public.fightor WHERE bill_series_id = NEW.bill_series_id);
    
    -- Calculate sequence
    IF last_bill IS NULL THEN
      next_seq := 1;
    ELSE
      last_seq := CAST(SPLIT_PART(last_bill, '/', 3) AS INTEGER);
      next_seq := last_seq + 1;
    END IF;
    
    -- Set bill number
    NEW.bill_number := prefix_val || sep_val || CAST(next_seq AS TEXT);
    NEW.bill_date := CURRENT_DATE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create triggers
CREATE TRIGGER auto_bill_number_on_spartan_insert
BEFORE INSERT ON public.spartan
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_bill_number_spartan();

CREATE TRIGGER auto_bill_number_on_fightor_insert
BEFORE INSERT ON public.fightor
FOR EACH ROW
EXECUTE FUNCTION public.auto_generate_bill_number_fightor();
