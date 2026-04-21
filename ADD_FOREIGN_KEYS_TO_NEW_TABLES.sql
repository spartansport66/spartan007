-- ADD FOREIGN KEY RELATIONSHIPS TO SPARTAN AND FIGHTOR TABLES
-- This script adds the foreign key relationships that Supabase PostgREST needs
-- to support relational queries like .select('*, dealers(id, name)')

-- 1. Add foreign key relationships for SPARTAN table
ALTER TABLE public.spartan
ADD CONSTRAINT spartan_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;

ALTER TABLE public.spartan
ADD CONSTRAINT spartan_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add other important relationships
ALTER TABLE public.spartan
ADD CONSTRAINT spartan_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 2. Add foreign key relationships for FIGHTOR table
ALTER TABLE public.fightor
ADD CONSTRAINT fightor_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;

ALTER TABLE public.fightor
ADD CONSTRAINT fightor_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add other important relationships
ALTER TABLE public.fightor
ADD CONSTRAINT fightor_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 3. Verify the relationships were created
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
