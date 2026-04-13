-- Fix RLS policies for payment_received table to allow accounts and admin users

-- Drop existing policies
DROP POLICY IF EXISTS "Sales persons can view their own payments" ON payment_received;
DROP POLICY IF EXISTS "Sales persons can insert payments" ON payment_received;
DROP POLICY IF EXISTS "Sales persons can update only pending payments" ON payment_received;
DROP POLICY IF EXISTS "Sales persons can delete only pending payments" ON payment_received;
DROP POLICY IF EXISTS "Admins can manage all payments" ON payment_received;

-- New RLS Policies

-- Allow sales persons to view their own payments
CREATE POLICY "Sales persons can view their own payments" ON payment_received
  FOR SELECT
  USING (created_by = auth.uid());

-- Allow sales persons to insert payments
CREATE POLICY "Sales persons can insert payments" ON payment_received
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- Allow sales persons to update only pending payments they created
CREATE POLICY "Sales persons can update only pending payments" ON payment_received
  FOR UPDATE
  USING (created_by = auth.uid() AND status = 'pending_approval')
  WITH CHECK (created_by = auth.uid() AND status = 'pending_approval');

-- Allow sales persons to delete only pending payments they created
CREATE POLICY "Sales persons can delete only pending payments" ON payment_received
  FOR DELETE
  USING (created_by = auth.uid() AND status = 'pending_approval');

-- Allow admin and accounts users to view all payments
CREATE POLICY "Admins and accounts can view all payments" ON payment_received
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type IN ('admin', 'accounts')
    )
  );

-- Allow admin and accounts users to update all payments (for approval/rejection)
CREATE POLICY "Admins and accounts can update all payments" ON payment_received
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type IN ('admin', 'accounts')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.user_type IN ('admin', 'accounts')
    )
  );
