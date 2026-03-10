-- Add QUANTITY column to online_order_staging table
-- This column stores the merged/deduplicated quantity of items from PDF extraction

-- Step 1: Add the quantity column to online_order_staging table
ALTER TABLE public.online_order_staging
ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Step 2: Enable RLS on online_order_staging if not already enabled
ALTER TABLE public.online_order_staging ENABLE ROW LEVEL SECURITY;

-- Step 3: Drop existing SELECT policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Enable select for authenticated users on online_order_staging" ON public.online_order_staging;

-- Step 4: Create SELECT policy - Allow authenticated users to read all staged orders
-- This policy allows:
-- - Users to view all pending online orders in staging
-- - The quantity column will be readable with this policy
CREATE POLICY "Enable select for authenticated users on online_order_staging"
ON public.online_order_staging
FOR SELECT
TO authenticated
USING (true);

-- Step 5: Drop existing INSERT policy if it exists
DROP POLICY IF EXISTS "Enable insert for authenticated users on online_order_staging" ON public.online_order_staging;

-- Step 6: Create INSERT policy - Allow authenticated users to insert new staged orders
CREATE POLICY "Enable insert for authenticated users on online_order_staging"
ON public.online_order_staging
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Step 7: Drop existing UPDATE policy if it exists
DROP POLICY IF EXISTS "Enable update for authenticated users on online_order_staging" ON public.online_order_staging;

-- Step 8: Create UPDATE policy - Allow users to update orders they created
CREATE POLICY "Enable update for authenticated users on online_order_staging"
ON public.online_order_staging
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- Step 9: Drop existing DELETE policy if it exists
DROP POLICY IF EXISTS "Enable delete for authenticated users on online_order_staging" ON public.online_order_staging;

-- Step 10: Create DELETE policy - Allow users to delete orders they created
CREATE POLICY "Enable delete for authenticated users on online_order_staging"
ON public.online_order_staging
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Verify the column was added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'online_order_staging' AND column_name = 'quantity';
