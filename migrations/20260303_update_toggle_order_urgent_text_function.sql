-- Replace toggle_order_urgent_text to accept JWT claim or fallback to profiles table
CREATE OR REPLACE FUNCTION public.toggle_order_urgent_text(p_order_id text, p_mark boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_claim jsonb;
  v_allowed boolean := false;
BEGIN
  -- try to read user_type from JWT via helper get_my_claim() if available
  BEGIN
    v_claim := public.get_my_claim('user_type'::text);
  EXCEPTION WHEN undefined_function THEN
    v_claim := NULL;
  END;

  IF v_claim IS NOT NULL THEN
    IF v_claim IN ('"sales_hod"'::jsonb, '"admin"'::jsonb, '"super_admin"'::jsonb) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    -- fallback to profiles table check
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (user_type = 'sales_hod' OR user_type = 'admin' OR user_type = 'super_admin')) THEN
      v_allowed := true;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.orders SET urgent = p_mark WHERE id = p_order_id::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_order_urgent_text(text, boolean) TO authenticated;
