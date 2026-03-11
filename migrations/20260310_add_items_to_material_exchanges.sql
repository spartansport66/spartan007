-- Migration: add items jsonb column to material_exchanges
ALTER TABLE IF EXISTS material_exchanges
  ADD COLUMN IF NOT EXISTS items jsonb;

COMMENT ON COLUMN material_exchanges.items IS 'JSON array of exchanged items: { product_id, product_name, quantity, exchange_quantity, unit_price }';
