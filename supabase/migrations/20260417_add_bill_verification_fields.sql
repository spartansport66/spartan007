-- Add bill status field to invoices table
-- Enables bill approval/rejection workflow in AccountsDashboard
-- Status values: null (pending), 'approve' (approved), 'reject' (rejected)

-- Add status column
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('approve', 'reject') OR status IS NULL);

-- Add rejection_reason column for storing rejection reasons
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Add column comments for documentation
COMMENT ON COLUMN invoices.status IS 'Bill approval status: NULL (pending review), ''approve'' (approved), ''reject'' (rejected)';
COMMENT ON COLUMN invoices.rejection_reason IS 'Reason for bill rejection if status is ''reject''';

-- Grant permissions to authenticated users
GRANT UPDATE ON invoices TO authenticated;
