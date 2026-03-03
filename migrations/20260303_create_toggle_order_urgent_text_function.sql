-- Helper RPC to accept order id as text (REST/JS may send strings)
CREATE OR REPLACE FUNCTION public.toggle_order_urgent_text(p_order_id text, p_mark boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- check caller is allowed: sales_hod or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND (user_type = 'sales_hod' OR user_type = 'admin' OR user_type = 'super_admin')
  ) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  UPDATE public.orders SET urgent = p_mark WHERE id = p_order_id::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_order_urgent_text(text, boolean) TO authenticated;
