-- Add a foreign key constraint to link the user who recorded the return.
ALTER TABLE public.sales_returns
ADD CONSTRAINT sales_returns_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;