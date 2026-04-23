-- Credit Notes Table Creation
-- For managing credit notes issued to dealers (accounting credit note schema)

-- ============================================================================
-- CREATE CREDIT NOTES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  credit_note_number TEXT NOT NULL UNIQUE,
  credit_note_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  financial_year_id UUID REFERENCES public.financial_years(id) ON DELETE SET NULL,
  
  -- Credit Note Details
  reason TEXT NOT NULL,
  description TEXT,
  credit_amount NUMERIC NOT NULL DEFAULT 0.00,
  
  -- Reference Information
  referenced_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  referenced_bill_number TEXT,
  
  -- Status Management
  status TEXT DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partially_used', 'fully_used', 'cancelled', 'expired')),
  approval_status TEXT DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  
  -- Credit Utilization Tracking
  credit_used NUMERIC NOT NULL DEFAULT 0.00,
  credit_remaining NUMERIC NOT NULL DEFAULT 0.00,
  
  -- Expiry Management
  expiry_date TIMESTAMP WITH TIME ZONE,
  
  -- GST Information
  gst_percentage NUMERIC DEFAULT 0.00,
  gst_amount NUMERIC DEFAULT 0.00,
  
  -- Approval Information
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approval_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Audit Trail
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexing for performance
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE CREDIT NOTE ITEMS TABLE (for breakdown)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.credit_note_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description TEXT,
  quantity_returned INTEGER DEFAULT 0,
  unit_price NUMERIC DEFAULT 0.00,
  item_amount NUMERIC NOT NULL DEFAULT 0.00,
  reason_for_return TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE CREDIT NOTE APPLICATIONS TABLE
-- ============================================================================
-- Tracks how credit notes are applied against invoices/payments
CREATE TABLE IF NOT EXISTS public.credit_note_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  dealer_id UUID NOT NULL REFERENCES public.dealers(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  
  -- Application Details
  amount_applied NUMERIC NOT NULL DEFAULT 0.00,
  application_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Audit
  applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.credit_note_applications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_credit_notes_dealer_id ON public.credit_notes(dealer_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_company_id ON public.credit_notes(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_status ON public.credit_notes(status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_credit_note_number ON public.credit_notes(credit_note_number);
CREATE INDEX IF NOT EXISTS idx_credit_notes_approval_status ON public.credit_notes(approval_status);
CREATE INDEX IF NOT EXISTS idx_credit_notes_expiry_date ON public.credit_notes(expiry_date);
CREATE INDEX IF NOT EXISTS idx_credit_note_items_credit_note_id ON public.credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_credit_note_id ON public.credit_note_applications(credit_note_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_dealer_id ON public.credit_note_applications(dealer_id);
CREATE INDEX IF NOT EXISTS idx_credit_note_applications_invoice_id ON public.credit_note_applications(invoice_id);

-- ============================================================================
-- CREATE FUNCTIONS FOR CREDIT NOTE MANAGEMENT
-- ============================================================================

-- Function to calculate dealer balance including credit notes
CREATE OR REPLACE FUNCTION get_dealer_balance_with_credits(
  p_dealer_id UUID,
  p_company_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  credit_notes_issued NUMERIC,
  credit_notes_used NUMERIC,
  credit_notes_balance NUMERIC,
  net_balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE WHEN invoices.payment_status != 'paid' THEN invoices.grand_total ELSE 0 END), 0)::NUMERIC as total_invoiced,
    COALESCE(SUM(payments.amount), 0)::NUMERIC as total_paid,
    COALESCE(SUM(CASE WHEN credit_notes.status != 'cancelled' THEN credit_notes.credit_amount ELSE 0 END), 0)::NUMERIC as credit_notes_issued,
    COALESCE(SUM(CASE WHEN credit_notes.status != 'cancelled' THEN credit_notes.credit_used ELSE 0 END), 0)::NUMERIC as credit_notes_used,
    COALESCE(SUM(CASE WHEN credit_notes.status != 'cancelled' THEN credit_notes.credit_remaining ELSE 0 END), 0)::NUMERIC as credit_notes_balance,
    (COALESCE(SUM(CASE WHEN invoices.payment_status != 'paid' THEN invoices.grand_total ELSE 0 END), 0) - COALESCE(SUM(payments.amount), 0) - COALESCE(SUM(CASE WHEN credit_notes.status != 'cancelled' THEN credit_notes.credit_remaining ELSE 0 END), 0))::NUMERIC as net_balance
  FROM public.dealers d
  LEFT JOIN public.invoices ON invoices.dealer_id = d.id AND (p_company_id IS NULL OR invoices.company_id = p_company_id)
  LEFT JOIN public.payments ON payments.dealer_id = d.id AND (p_company_id IS NULL OR payments.company_id = p_company_id)
  LEFT JOIN public.credit_notes ON credit_notes.dealer_id = d.id AND (p_company_id IS NULL OR credit_notes.company_id = p_company_id)
  WHERE d.id = p_dealer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update credit note balance after application
CREATE OR REPLACE FUNCTION update_credit_note_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update credit note used and remaining amounts
  UPDATE public.credit_notes
  SET 
    credit_used = credit_used + NEW.amount_applied,
    credit_remaining = credit_remaining - NEW.amount_applied,
    status = CASE 
      WHEN (credit_remaining - NEW.amount_applied) <= 0 THEN 'fully_used'
      WHEN (credit_remaining - NEW.amount_applied) < credit_amount THEN 'partially_used'
      ELSE status
    END,
    updated_at = NOW()
  WHERE id = NEW.credit_note_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for credit note applications
DROP TRIGGER IF EXISTS trg_update_credit_note_balance ON public.credit_note_applications;
CREATE TRIGGER trg_update_credit_note_balance
AFTER INSERT ON public.credit_note_applications
FOR EACH ROW
EXECUTE FUNCTION update_credit_note_balance();

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Credit Notes RLS
DROP POLICY IF EXISTS "credit_notes_select_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_select_policy" ON public.credit_notes
  FOR SELECT USING (
    auth.uid() = created_by OR
    auth.uid() = approved_by OR
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "credit_notes_insert_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_insert_policy" ON public.credit_notes
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "credit_notes_update_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_update_policy" ON public.credit_notes
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "credit_notes_delete_policy" ON public.credit_notes;
CREATE POLICY "credit_notes_delete_policy" ON public.credit_notes
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

-- Credit Note Items RLS
DROP POLICY IF EXISTS "credit_note_items_select_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_select_policy" ON public.credit_note_items
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    ) OR
    EXISTS (
      SELECT 1 FROM public.credit_notes cn
      WHERE cn.id = credit_note_id AND cn.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "credit_note_items_insert_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_insert_policy" ON public.credit_note_items
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "credit_note_items_update_policy" ON public.credit_note_items;
CREATE POLICY "credit_note_items_update_policy" ON public.credit_note_items
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

-- Credit Note Applications RLS
DROP POLICY IF EXISTS "credit_note_applications_select_policy" ON public.credit_note_applications;
CREATE POLICY "credit_note_applications_select_policy" ON public.credit_note_applications
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    ) OR
    auth.uid() = applied_by
  );

DROP POLICY IF EXISTS "credit_note_applications_insert_policy" ON public.credit_note_applications;
CREATE POLICY "credit_note_applications_insert_policy" ON public.credit_note_applications
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

DROP POLICY IF EXISTS "credit_note_applications_update_policy" ON public.credit_note_applications;
CREATE POLICY "credit_note_applications_update_policy" ON public.credit_note_applications
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE COALESCE(is_admin, false) = true OR user_type = 'admin'
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE ON public.credit_notes TO authenticated;
GRANT SELECT, INSERT ON public.credit_note_items TO authenticated;
GRANT SELECT, INSERT ON public.credit_note_applications TO authenticated;
GRANT EXECUTE ON FUNCTION get_dealer_balance_with_credits TO authenticated;
