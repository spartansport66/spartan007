-- Add RLS policies for invoices table
-- Allows all authenticated users to view and manage bill approval

-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Allow ALL authenticated users to SELECT invoices
DROP POLICY IF EXISTS "Billing users and admins can SELECT invoices" ON invoices;
CREATE POLICY "All authenticated users can SELECT invoices"
ON invoices
FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow ANY authenticated user to UPDATE invoices (status, rejection, reassignment tracking)
-- This allows sales_person, billing, admin, super_admin to manage invoice rejections/reassignments
DROP POLICY IF EXISTS "Billing users and admins can UPDATE invoices" ON invoices;
CREATE POLICY "All authenticated users can UPDATE invoices"
ON invoices
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions to authenticated users
GRANT SELECT, UPDATE ON invoices TO authenticated;
