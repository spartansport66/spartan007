-- Add mapped_product_id column to online_order_staging table
-- This column stores a reference to the mapped product (UUID) when a PDF-extracted item is mapped to a product in the DB

-- Step 1: Add the mapped_product_id column
ALTER TABLE public.online_order_staging
ADD COLUMN IF NOT EXISTS mapped_product_id UUID NULL;

-- Step 2: Add foreign key constraint referencing products table
-- Add constraint only if it doesn't already exist (Postgres doesn't support IF NOT EXISTS on ADD CONSTRAINT)
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'fk_online_order_staging_mapped_product'
	) THEN
		EXECUTE 'ALTER TABLE public.online_order_staging
			ADD CONSTRAINT fk_online_order_staging_mapped_product
			FOREIGN KEY (mapped_product_id) REFERENCES public.products(id) ON DELETE SET NULL';
	END IF;
END
$$;

-- Step 3: Enable Row Level Security (if already enabled this is safe)
ALTER TABLE public.online_order_staging ENABLE ROW LEVEL SECURITY;

-- Step 4: Recreate policies so the new column is accessible/insertable by authenticated users
DROP POLICY IF EXISTS "Enable select for authenticated users on online_order_staging" ON public.online_order_staging;
CREATE POLICY "Enable select for authenticated users on online_order_staging"
ON public.online_order_staging
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users on online_order_staging" ON public.online_order_staging;
CREATE POLICY "Enable insert for authenticated users on online_order_staging"
ON public.online_order_staging
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Enable update for authenticated users on online_order_staging" ON public.online_order_staging;
CREATE POLICY "Enable update for authenticated users on online_order_staging"
ON public.online_order_staging
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Enable delete for authenticated users on online_order_staging" ON public.online_order_staging;
CREATE POLICY "Enable delete for authenticated users on online_order_staging"
ON public.online_order_staging
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

-- Verify the column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'online_order_staging' AND column_name = 'mapped_product_id';
