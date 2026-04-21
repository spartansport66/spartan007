-- PROPER FIX FOR FOREIGN KEY CONSTRAINTS - RUN THIS INSTEAD
-- This removes the order_id constraint that's causing violations

-- Step 1: Drop the problematic foreign key constraints
DO $$ 
BEGIN
  -- Drop spartan order_id constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'spartan_order_id_fkey' 
    AND table_name = 'spartan'
  ) THEN
    ALTER TABLE public.spartan DROP CONSTRAINT spartan_order_id_fkey;
  END IF;

  -- Drop fightor order_id constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fightor_order_id_fkey' 
    AND table_name = 'fightor'
  ) THEN
    ALTER TABLE public.fightor DROP CONSTRAINT fightor_order_id_fkey;
  END IF;
END $$;

-- Step 2: Drop any existing dealer/company constraints to re-add them cleanly
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'spartan_dealer_id_fkey' 
    AND table_name = 'spartan'
  ) THEN
    ALTER TABLE public.spartan DROP CONSTRAINT spartan_dealer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'spartan_company_id_fkey' 
    AND table_name = 'spartan'
  ) THEN
    ALTER TABLE public.spartan DROP CONSTRAINT spartan_company_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fightor_dealer_id_fkey' 
    AND table_name = 'fightor'
  ) THEN
    ALTER TABLE public.fightor DROP CONSTRAINT fightor_dealer_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fightor_company_id_fkey' 
    AND table_name = 'fightor'
  ) THEN
    ALTER TABLE public.fightor DROP CONSTRAINT fightor_company_id_fkey;
  END IF;
END $$;

-- Step 3: Add ONLY the dealer and company foreign keys (these are reliable)
ALTER TABLE public.spartan
ADD CONSTRAINT spartan_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;

ALTER TABLE public.spartan
ADD CONSTRAINT spartan_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.fightor
ADD CONSTRAINT fightor_dealer_id_fkey 
  FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;

ALTER TABLE public.fightor
ADD CONSTRAINT fightor_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

-- Step 4: Verify the fixed relationships
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('spartan', 'fightor')
ORDER BY tc.table_name, kcu.column_name;
