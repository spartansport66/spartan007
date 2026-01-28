ALTER TABLE public.payments
ADD COLUMN dealer_id uuid NULL,
ADD COLUMN recorded_by uuid NULL;

-- Add foreign key constraints (recommended)
ALTER TABLE public.payments
ADD CONSTRAINT payments_dealer_id_fkey FOREIGN KEY (dealer_id) REFERENCES public.dealers(id) ON DELETE SET NULL;

ALTER TABLE public.payments
ADD CONSTRAINT payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Note: If Row Level Security (RLS) is enabled on the 'payments' table, 
-- you may need to update your RLS policies to allow sales persons to insert 
-- records where 'dealer_id' is set (for general balance payments).