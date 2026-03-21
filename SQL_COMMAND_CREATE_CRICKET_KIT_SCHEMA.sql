-- ============================================
-- CRICKET KIT SCHEMA
-- ============================================

-- 1. CREATE CRICKET_KITS TABLE (The kit definition)
CREATE TABLE IF NOT EXISTS public.cricket_kits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT,
  total_dp NUMERIC DEFAULT 0,
  total_gst NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CREATE CRICKET_KIT_ITEMS TABLE (Items inside a kit)
CREATE TABLE IF NOT EXISTS public.cricket_kit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_id UUID NOT NULL REFERENCES public.cricket_kits(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(kit_id, product_id)
);

-- 3. CREATE INDEX FOR FASTER LOOKUPS
CREATE INDEX IF NOT EXISTS idx_cricket_kit_items_kit_id ON public.cricket_kit_items(kit_id);
CREATE INDEX IF NOT EXISTS idx_cricket_kit_items_product_id ON public.cricket_kit_items(product_id);

-- 4. ENABLE RLS
ALTER TABLE public.cricket_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cricket_kit_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES - ALLOW PUBLIC ACCESS
DROP POLICY IF EXISTS "Allow all users to read cricket_kits" ON public.cricket_kits;
DROP POLICY IF EXISTS "Allow all users to read cricket_kit_items" ON public.cricket_kit_items;

CREATE POLICY "Allow all users to read cricket_kits"
ON public.cricket_kits
FOR SELECT
USING (true);

CREATE POLICY "Allow all users to read cricket_kit_items"
ON public.cricket_kit_items
FOR SELECT
USING (true);

-- 6. CREATE FUNCTION TO GET KIT WITH ALL ITEMS
CREATE OR REPLACE FUNCTION get_cricket_kit_details(kit_id_param UUID)
RETURNS TABLE (
  kit_id UUID,
  kit_name TEXT,
  kit_description TEXT,
  kit_category TEXT,
  product_id UUID,
  product_name TEXT,
  product_code TEXT,
  product_dp NUMERIC,
  product_gst TEXT,
  kit_item_quantity INTEGER,
  kit_item_discount_percent NUMERIC,
  kit_item_gst_percent NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    ck.id as kit_id,
    ck.name as kit_name,
    ck.description as kit_description,
    ck.category as kit_category,
    p.id as product_id,
    p.name as product_name,
    p.code as product_code,
    p.dp as product_dp,
    p.gst as product_gst,
    cki.quantity as kit_item_quantity,
    cki.discount_percent as kit_item_discount_percent,
    cki.gst_percent as kit_item_gst_percent
  FROM public.cricket_kits ck
  LEFT JOIN public.cricket_kit_items cki ON cki.kit_id = ck.id
  LEFT JOIN public.products p ON p.id = cki.product_id
  WHERE ck.id = kit_id_param AND ck.is_active = true;
$$;

-- 7. GRANT PERMISSIONS
GRANT EXECUTE ON FUNCTION public.get_cricket_kit_details(UUID) TO anon, authenticated;
GRANT SELECT ON public.cricket_kits TO anon, authenticated;
GRANT SELECT ON public.cricket_kit_items TO anon, authenticated;
