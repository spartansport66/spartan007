-- Create stock_receipts table
CREATE TABLE public.stock_receipts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;

-- Policies for stock_receipts
CREATE POLICY "Admins and Inventory Managers can manage stock receipts" ON public.stock_receipts
FOR ALL TO authenticated
USING (public.has_inventory_access())
WITH CHECK (public.has_inventory_access());

-- Function to revert stock_in when a receipt is deleted
CREATE OR REPLACE FUNCTION public.revert_stock_in_on_receipt_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    UPDATE public.products
    SET stock_in = stock_in - OLD.quantity,
        closing_stock = opening_stock + (stock_in - OLD.quantity) - stock_out
    WHERE id = OLD.product_id;
    RETURN OLD;
END;
$function$;

-- Trigger for the function
CREATE TRIGGER on_stock_receipt_delete
  AFTER DELETE ON public.stock_receipts
  FOR EACH ROW EXECUTE FUNCTION public.revert_stock_in_on_receipt_delete();