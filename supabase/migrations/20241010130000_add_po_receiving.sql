-- Add quantity_received to purchase_order_items to track what has been delivered
ALTER TABLE public.purchase_order_items
ADD COLUMN quantity_received NUMERIC NOT NULL DEFAULT 0;

-- Create a function to safely increment raw material stock
CREATE OR REPLACE FUNCTION public.increment_raw_material_stock(p_material_id UUID, p_quantity NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.raw_materials
  SET current_stock = current_stock + p_quantity,
      updated_at = NOW()
  WHERE id = p_material_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;