-- Create a secure admin function for tracking payment status
-- Note: Credit limit is STATIC and never changes
-- Consumed limit is calculated as: Total Billed - Total Received
-- This function just validates permissions for the accounts user

CREATE OR REPLACE FUNCTION public.update_dealer_credit_on_payment_approval(
  p_dealer_id UUID,
  p_amount NUMERIC,
  p_operation TEXT -- 'increase' or 'decrease' (for reference, not used now)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_type TEXT;
  v_current_credit NUMERIC;
BEGIN
  -- Verify that the caller is an accounts user
  v_user_type := (SELECT user_type FROM profiles WHERE id = auth.uid());
  
  IF v_user_type IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not authenticated');
  END IF;
  
  IF v_user_type NOT IN ('accounts', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied: only accounts and admin users can manage payments');
  END IF;
  
  -- Get current dealer credit limit (static - never changes)
  SELECT credit_limit INTO v_current_credit
  FROM dealers
  WHERE id = p_dealer_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Dealer not found');
  END IF;
  
  -- Note: We do NOT update credit_limit anymore
  -- Credit limit is static, only consumed_limit changes based on total payments
  -- The frontend will recalculate: Consumed Limit = Total Billed - Total Received
  
  RETURN json_build_object(
    'success', true,
    'new_credit_limit', v_current_credit,
    'message', 'Payment status updated. Consumed limit will be recalculated dynamically.'
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute permission to authenticated users (all authenticated roles can call this)
GRANT EXECUTE ON FUNCTION public.update_dealer_credit_on_payment_approval(UUID, NUMERIC, TEXT) TO authenticated;
