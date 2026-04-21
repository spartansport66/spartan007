-- Migration: create RPC to safely increment bill_series.current_sequence_number
-- Run this migration in Supabase to add the function used by the frontend

CREATE OR REPLACE FUNCTION public.increment_bill_series(p_bill_series_id uuid, p_increment_by integer DEFAULT 1)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.bill_series
  SET current_sequence_number = current_sequence_number + p_increment_by
  WHERE id = p_bill_series_id;
END;
$$;

-- Grant execute to authenticated role if needed (optional)
-- GRANT EXECUTE ON FUNCTION public.increment_bill_series(uuid, integer) TO authenticated;
