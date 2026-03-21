-- Update RPC functions to include combo code column

-- ============================================================================
-- DROP EXISTING FUNCTIONS (required when changing return type)
-- ============================================================================
DROP FUNCTION IF EXISTS get_combo_details(uuid);
DROP FUNCTION IF EXISTS get_all_active_combos_with_items();

-- ============================================================================
-- CREATE RPC FUNCTION: get_combo_details
-- ============================================================================
CREATE FUNCTION get_combo_details(combo_id_param UUID)
RETURNS TABLE (
  combo_id UUID,
  combo_code TEXT,
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
    c.code,
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
  GROUP BY c.id, c.code, c.name, c.description, c.combo_dp, c.combo_gst;
END;
$$;

-- ============================================================================
-- CREATE RPC FUNCTION: get_all_active_combos_with_items
-- ============================================================================
CREATE FUNCTION get_all_active_combos_with_items()
RETURNS TABLE (
  combo_id UUID,
  combo_code TEXT,
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
    c.code,
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
  GROUP BY c.id, c.code, c.name, c.description, c.category, c.combo_dp, c.combo_gst
  ORDER BY c.created_at DESC;
END;
$$;
