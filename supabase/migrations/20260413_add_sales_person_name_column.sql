-- Add sales_person_name column to payment_received table
-- This stores the sales person's name at the time of payment submission
-- Eliminates need to do profile lookups and avoids RLS recursion issues

ALTER TABLE payment_received
ADD COLUMN sales_person_name VARCHAR(255);

-- Add comment
COMMENT ON COLUMN payment_received.sales_person_name IS 'Name of the sales person who submitted the payment (stored at submission time to avoid profile lookup)';
