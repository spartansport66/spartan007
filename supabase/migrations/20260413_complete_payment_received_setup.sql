-- Complete setup for payment_received table with proper RLS for Accounts Dashboard

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Sales persons can view their own payments" ON payment_received;
DROP POLICY IF EXISTS "Sales persons can insert payments" ON payment_received;
DROP POLICY IF EXISTS "Sales persons can update only pending payments" ON payment_received;
DROP POLICY IF EXISTS "Sales persons can delete only pending payments" ON payment_received;
DROP POLICY IF EXISTS "Admins can manage all payments" ON payment_received;
DROP POLICY IF EXISTS "Admins and accounts can view all payments" ON payment_received;
DROP POLICY IF EXISTS "Admins and accounts can update all payments" ON payment_received;

-- Step 2: Create comprehensive RLS policies

-- POLICY 1: Sales persons can view ONLY their own created payments
CREATE POLICY "Sales persons can view their own payments" ON payment_received
  FOR SELECT
  USING (auth.uid() = created_by);

-- POLICY 2: Sales persons can insert (create) payments with their own user_id
CREATE POLICY "Sales persons can insert payments" ON payment_received
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- POLICY 3: Sales persons can update only their pending payments
CREATE POLICY "Sales persons can update pending payments" ON payment_received
  FOR UPDATE
  USING (auth.uid() = created_by AND status = 'pending_approval')
  WITH CHECK (auth.uid() = created_by);

-- POLICY 4: Sales persons can delete only their pending payments
CREATE POLICY "Sales persons can delete pending payments" ON payment_received
  FOR DELETE
  USING (auth.uid() = created_by AND status = 'pending_approval');

-- POLICY 5: Admin users can view all payments
CREATE POLICY "Admin users can view all payments" ON payment_received
  FOR SELECT
  USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- POLICY 6: Admin users can insert payments
CREATE POLICY "Admin users can insert payments" ON payment_received
  FOR INSERT
  WITH CHECK (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- POLICY 7: Admin users can update all payments
CREATE POLICY "Admin users can update all payments" ON payment_received
  FOR UPDATE
  USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- POLICY 8: Admin users can delete all payments
CREATE POLICY "Admin users can delete all payments" ON payment_received
  FOR DELETE
  USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- POLICY 9: Accounts users can view all payments
CREATE POLICY "Accounts users can view all payments" ON payment_received
  FOR SELECT
  USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'accounts'
  );

-- POLICY 10: Accounts users can update all payments (for approval/rejection)
CREATE POLICY "Accounts users can update all payments" ON payment_received
  FOR UPDATE
  USING (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'accounts'
  )
  WITH CHECK (
    (SELECT user_type FROM profiles WHERE id = auth.uid()) = 'accounts'
  );
