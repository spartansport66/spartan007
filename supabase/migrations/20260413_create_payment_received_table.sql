-- Create payment_received table for tracking payments submitted by sales persons
CREATE TABLE payment_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dealer_id UUID NOT NULL REFERENCES dealers(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL,
  payment_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'completed', 'rejected')),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_payment_received_dealer_id ON payment_received(dealer_id);
CREATE INDEX idx_payment_received_status ON payment_received(status);
CREATE INDEX idx_payment_received_created_by ON payment_received(created_by);
CREATE INDEX idx_payment_received_created_at ON payment_received(created_at DESC);

-- Enable RLS
ALTER TABLE payment_received ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Sales persons can view and insert their own payments
CREATE POLICY "Sales persons can view their own payments" ON payment_received
  FOR SELECT
  USING (created_by = auth.uid() OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Sales persons can insert payments" ON payment_received
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Sales persons can update only pending payments" ON payment_received
  FOR UPDATE
  USING (created_by = auth.uid() AND status = 'pending_approval')
  WITH CHECK (created_by = auth.uid() AND status = 'pending_approval');

CREATE POLICY "Sales persons can delete only pending payments" ON payment_received
  FOR DELETE
  USING (created_by = auth.uid() AND status = 'pending_approval');

-- RLS Policy: Admins can view all and update for approvals
CREATE POLICY "Admins can manage all payments" ON payment_received
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
