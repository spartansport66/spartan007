-- Add is_active column to products table
ALTER TABLE public.products ADD COLUMN is_active BOOLEAN DEFAULT TRUE;

-- Create index on is_active for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);

-- Add index on combination of is_active and category_id for common queries
CREATE INDEX IF NOT EXISTS idx_products_active_category ON public.products(is_active, category_id);
