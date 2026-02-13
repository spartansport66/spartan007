-- Step 1: Create a trigger function to increment stock on sales return.
CREATE OR REPLACE FUNCTION public.handle_sales_return_stock_increment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.products
    SET stock_in = stock_in + NEW.quantity,
        closing_stock = opening_stock + (stock_in + NEW.quantity) - stock_out
    WHERE id = NEW.product_id;
    RETURN NEW;
END;
$$;

-- Step 2: Create a trigger function to revert stock when a sales return is deleted.
CREATE OR REPLACE FUNCTION public.revert_stock_on_return_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.products
    SET stock_in = stock_in - OLD.quantity,
        closing_stock = opening_stock + (stock_in - OLD.quantity) - stock_out
    WHERE id = OLD.product_id;
    RETURN OLD;
END;
$$;

-- Step 3: Drop existing triggers on sales_returns if they exist, to be safe.
DROP TRIGGER IF EXISTS on_sales_return_insert ON public.sales_returns;
DROP TRIGGER IF EXISTS on_sales_return_delete ON public.sales_returns;

-- Step 4: Create the new triggers on the sales_returns table.
CREATE TRIGGER on_sales_return_insert
  AFTER INSERT ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.handle_sales_return_stock_increment();

CREATE TRIGGER on_sales_return_delete
  AFTER DELETE ON public.sales_returns
  FOR EACH ROW EXECUTE FUNCTION public.revert_stock_on_return_delete();

-- Step 5: Clean up the redundant stock_receipts table and its related functions/triggers.
-- This simplifies the logic and removes the source of potential conflicts.
DROP TABLE IF EXISTS public.stock_receipts;
DROP FUNCTION IF EXISTS public.revert_stock_in_on_delete();
-- The trigger on stock_receipts will be dropped automatically with the table.