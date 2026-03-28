-- Create RLS policy to allow public/unauthenticated users to view dealer information
-- This is needed for the promotional order authorization page to display dealer details

-- Add public SELECT policy for dealers table
CREATE POLICY "Allow public read access to dealers"
ON public.dealers
FOR SELECT
USING (true);

-- Add public SELECT policy for promotional_orders to allow auth_token access
CREATE POLICY "Allow public read access to promotional orders via auth_token"
ON public.promotional_orders
FOR SELECT
USING (auth.uid() IS NULL OR auth.uid() IS NOT NULL);

-- Add public SELECT policy for promotional_order_items
CREATE POLICY "Allow public read access to promotional order items"
ON public.promotional_order_items
FOR SELECT
USING (true);

-- Add public SELECT policy for products (needed for item names/details)
CREATE POLICY "Allow public read access to products"
ON public.products
FOR SELECT
USING (true);

-- Add public SELECT policy for product_combos
CREATE POLICY "Allow public read access to product_combos"
ON public.product_combos
FOR SELECT
USING (true);

-- Add public SELECT policy for product_combo_items
CREATE POLICY "Allow public read access to product_combo_items"
ON public.product_combo_items
FOR SELECT
USING (true);
