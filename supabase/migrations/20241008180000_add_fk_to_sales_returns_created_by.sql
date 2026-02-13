DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.sales_returns'::regclass
      AND conname = 'sales_returns_created_by_fkey'
  ) THEN
    ALTER TABLE public.sales_returns
    ADD CONSTRAINT sales_returns_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
  END IF;
END;
$$;