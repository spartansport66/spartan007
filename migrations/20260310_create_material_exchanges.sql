-- Migration: create material_exchanges table
CREATE TABLE IF NOT EXISTS material_exchanges (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  original_order_no text NOT NULL,
  new_order_no text NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE material_exchanges IS 'Records material exchange operations, linking an original order number to a new generated exchange order number with a reason.';
