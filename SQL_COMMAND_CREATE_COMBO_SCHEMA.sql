-- ============================================================================
-- COMBO OFFER SCHEMA FOR CRICKET EQUIPMENT
-- ============================================================================
-- This schema enables admins to create product combos/bundles
-- When users place orders, they can select a combo instead of individual items
-- Selecting a combo automatically includes all associated items

-- ============================================================================
-- TABLE: product_combos
-- ============================================================================
CREATE TABLE IF NOT EXISTS product_combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  combo_dp DECIMAL(12, 2) DEFAULT 0,
  combo_gst DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on active combos for faster queries
CREATE INDEX IF NOT EXISTS idx_product_combos_active ON product_combos(is_active);
CREATE INDEX IF NOT EXISTS idx_product_combos_name ON product_combos(name);

-- ============================================================================
-- TABLE: product_combo_items
-- ============================================================================
-- Junction table linking products to combos with specific quantities and overrides
CREATE TABLE IF NOT EXISTS product_combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES product_combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  gst_percent DECIMAL(5, 2) DEFAULT 18,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(combo_id, product_id)
);

-- Create indexes for combo items
CREATE INDEX IF NOT EXISTS idx_product_combo_items_combo_id ON product_combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_product_combo_items_product_id ON product_combo_items(product_id);

-- ============================================================================
-- RLS POLICIES FOR product_combos
-- ============================================================================
ALTER TABLE product_combos ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT (authenticated and anon)
CREATE POLICY "Allow public select on combos" ON product_combos
  FOR SELECT 
  USING (true);

-- Allow authenticated users to create combos
CREATE POLICY "Allow authenticated create combos" ON product_combos
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update combos
CREATE POLICY "Allow authenticated update combos" ON product_combos
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete combos
CREATE POLICY "Allow authenticated delete combos" ON product_combos
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- RLS POLICIES FOR product_combo_items
-- ============================================================================
ALTER TABLE product_combo_items ENABLE ROW LEVEL SECURITY;

-- Allow public SELECT
CREATE POLICY "Allow public select on combo items" ON product_combo_items
  FOR SELECT 
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert combo items" ON product_combo_items
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update
CREATE POLICY "Allow authenticated update combo items" ON product_combo_items
  FOR UPDATE 
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete items
CREATE POLICY "Allow authenticated delete combo items" ON product_combo_items
  FOR DELETE 
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- RPC FUNCTION: get_combo_details
-- ============================================================================
-- Returns a combo with all its associated items and product details
CREATE OR REPLACE FUNCTION get_combo_details(combo_id_param UUID)
RETURNS TABLE (
  combo_id UUID,
  combo_name TEXT,
  combo_description TEXT,
  combo_dp DECIMAL,
  combo_gst DECIMAL,
  items JSON
) 
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.combo_dp,
    c.combo_gst,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', pci.id,
        'combo_id', pci.combo_id,
        'product_id', pci.product_id,
        'product_name', p.name,
        'product_code', p.code,
        'size', p.size,
        'quantity', pci.quantity,
        'discount_percent', pci.discount_percent,
        'gst_percent', pci.gst_percent,
        'unit_price', p.dp
      ) ORDER BY pci.created_at ASC
    ) FILTER (WHERE pci.id IS NOT NULL) as items
  FROM product_combos c
  LEFT JOIN product_combo_items pci ON c.id = pci.combo_id
  LEFT JOIN products p ON pci.product_id = p.id
  WHERE c.id = combo_id_param
  GROUP BY c.id, c.name, c.description, c.combo_dp, c.combo_gst;
END;
$$;

-- ============================================================================
-- RPC FUNCTION: get_all_active_combos_with_items
-- ============================================================================
-- Returns all active combos with their items - useful for order creation dropdowns
CREATE OR REPLACE FUNCTION get_all_active_combos_with_items()
RETURNS TABLE (
  combo_id UUID,
  combo_name TEXT,
  combo_description TEXT,
  combo_category TEXT,
  combo_dp DECIMAL,
  combo_gst DECIMAL,
  item_count INTEGER,
  items JSON
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.category,
    c.combo_dp,
    c.combo_gst,
    COUNT(pci.id)::INTEGER as item_count,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', pci.id,
        'product_id', pci.product_id,
        'product_name', p.name,
        'product_code', p.code,
        'size', p.size,
        'quantity', pci.quantity,
        'discount_percent', pci.discount_percent,
        'gst_percent', pci.gst_percent,
        'unit_price', p.dp
      ) ORDER BY pci.created_at ASC
    ) FILTER (WHERE pci.id IS NOT NULL) as items
  FROM product_combos c
  LEFT JOIN product_combo_items pci ON c.id = pci.combo_id
  LEFT JOIN products p ON pci.product_id = p.id
  WHERE c.is_active = TRUE
  GROUP BY c.id, c.name, c.description, c.category, c.combo_dp, c.combo_gst
  ORDER BY c.name;
END;
$$;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
GRANT SELECT ON product_combos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON product_combos TO authenticated;
GRANT SELECT ON product_combo_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON product_combo_items TO authenticated;
GRANT EXECUTE ON FUNCTION get_combo_details TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_all_active_combos_with_items TO anon, authenticated;

-- ============================================================================
-- TRIGGER: Update updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_product_combos_updated_at ON product_combos;
CREATE TRIGGER update_product_combos_updated_at
  BEFORE UPDATE ON product_combos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_timestamp();

-- ============================================================================
-- SAMPLE DATA (Optional - uncomment to add test combos)
-- ============================================================================
-- INSERT INTO product_combos (name, description, category, combo_dp, combo_gst, is_active)
-- VALUES 
--   ('Beginner Cricket Kit', 'Complete starter bundle for new players', 'Bundles', 2500.00, 18, TRUE),
--   ('Professional Match Kit', 'Pro-level equipment for competitive play', 'Bundles', 8500.00, 18, TRUE);
