-- Add the missing recorded_by column
ALTER TABLE public.payments
ADD COLUMN recorded_by uuid NULL;

-- Add foreign key constraints (if they don't exist)
-- Note: If payments_dealer_id_fkey already exists, this will fail. You can skip this block if you are sure the constraint is there.
-- If you encounter an error here, comment out the block below and proceed.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_dealer_id_fkey') THEN
        ALTER TABLE public.payments
        ADD CONSTRAINT payments_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;
    END IF;
END
$$;

ALTER TABLE public.payments
ADD CONSTRAINT payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Note: If Row Level Security (RLS) is enabled on the 'payments' table, 
-- you may need to update your RLS policies to allow sales persons to insert 
-- records where 'dealer_id' is set (for general balance payments).