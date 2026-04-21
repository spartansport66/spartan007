-- FIX FOREIGN KEY CONSTRAINTS FOR SPARTAN AND FIGHTOR TABLES
-- This removes the problematic constraints and adds only the reliable ones

-- 1. Drop the problematic foreign key constraints (if they exist)
ALTER TABLE public.spartan
DROP CONSTRAINT IF EXISTS spartan_order_id_fkey;

ALTER TABLE public.fightor
DROP CONSTRAINT IF EXISTS fightor_order_id_fkey;

-- 2. Check for orphaned order_ids before re-adding constraints
-- Run this to see the orphaned records:
SELECT 
  COUNT(*) as orphaned_records,
  COUNT(DISTINCT order_id) as orphaned_order_ids
FROM public.spartan
WHERE order_id IS NOT NULL 
  AND order_id NOT IN (SELECT id FROM public.orders);

SELECT 
  COUNT(*) as orphaned_records,
  COUNT(DISTINCT order_id) as orphaned_order_ids
FROM public.fightor
WHERE order_id IS NOT NULL 
  AND order_id NOT IN (SELECT id FROM public.orders);

-- 3. Option A: Keep only the dealer_id and company_id foreign keys (safer)
-- These are more likely to be valid references

-- Ensure spartan has the relationships that are valid:
ALTER TABLE public.spartan
ADD CONSTRAINT spartan_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL
  ON CONFLICT DO NOTHING;

ALTER TABLE public.spartan
ADD CONSTRAINT spartan_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL
  ON CONFLICT DO NOTHING;

-- Ensure fightor has the relationships that are valid:
ALTER TABLE public.fightor
ADD CONSTRAINT fightor_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL
  ON CONFLICT DO NOTHING;

ALTER TABLE public.fightor
ADD CONSTRAINT fightor_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL
  ON CONFLICT DO NOTHING;

-- 4. Verify the current foreign keys
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('spartan', 'fightor')
ORDER BY tc.table_name;
