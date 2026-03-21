-- ============================================================================
-- COMBO SYSTEM - UNDO/ROLLBACK SCRIPT
-- ============================================================================
-- Use this to remove combo system if needed
-- WARNING: This will delete ALL combo data. Do this only if necessary.
-- ============================================================================

-- Step 1: Drop triggers
DROP TRIGGER IF EXISTS update_product_combos_updated_at ON product_combos;

-- Step 2: Drop functions
DROP FUNCTION IF EXISTS update_updated_at_timestamp();
DROP FUNCTION IF EXISTS get_combo_details(UUID);
DROP FUNCTION IF EXISTS get_all_active_combos_with_items();

-- Step 3: Drop RLS policies on product_combo_items
DROP POLICY IF EXISTS "Allow public select on combo items" ON product_combo_items;
DROP POLICY IF EXISTS "Allow authenticated insert combo items" ON product_combo_items;
DROP POLICY IF EXISTS "Allow authenticated update combo items" ON product_combo_items;
DROP POLICY IF EXISTS "Allow authenticated delete combo items" ON product_combo_items;

-- Step 4: Drop table product_combo_items (has foreign key to product_combos)
DROP TABLE IF EXISTS product_combo_items CASCADE;

-- Step 5: Drop RLS policies on product_combos
DROP POLICY IF EXISTS "Allow public select on combos" ON product_combos;
DROP POLICY IF EXISTS "Allow authenticated create combos" ON product_combos;
DROP POLICY IF EXISTS "Allow authenticated update combos" ON product_combos;
DROP POLICY IF EXISTS "Allow authenticated delete combos" ON product_combos;

-- Step 6: Drop table product_combos
DROP TABLE IF EXISTS product_combos CASCADE;

-- ============================================================================
-- CONFIRMATION
-- ============================================================================
-- You can verify rollback was successful by running:
-- SELECT COUNT(*) FROM product_combos;
-- This should return an error "table does not exist" - that's expected and correct
-- ============================================================================
