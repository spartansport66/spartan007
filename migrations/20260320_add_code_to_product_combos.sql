-- Add code column to product_combos table
-- This column stores a unique code identifier for each combo (similar to product codes)

ALTER TABLE product_combos
ADD COLUMN IF NOT EXISTS code TEXT UNIQUE;

-- Create index on code for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_combos_code ON product_combos(code);

-- Update unique constraint to include both name and code
COMMENT ON COLUMN product_combos.code IS 'Unique identifier code for the combo (e.g., CB001, BUNDLE-KIT, etc.)';
