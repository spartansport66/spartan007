-- Add visit_status and remarks columns to sales_person_visits
ALTER TABLE public.sales_person_visits
ADD COLUMN visit_status text NOT NULL DEFAULT 'Routine Visit',
ADD COLUMN remarks text;

-- Optional: Create an enum type for better data integrity if needed, 
-- but using text for flexibility based on current implementation.