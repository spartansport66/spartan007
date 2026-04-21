-- Create RPC function for billing users to update dealer GST
-- SECURITY DEFINER bypasses RLS for safe operations

CREATE OR REPLACE FUNCTION public.update_dealer_gst(
  p_dealer_id UUID,
  p_gst_number TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_type TEXT;
  v_updated_row RECORD;
BEGIN
  -- Check user permission
  SELECT user_type INTO v_user_type
  FROM public.profiles
  WHERE id = auth.uid();

  -- Only allow billing and admin users
  IF v_user_type NOT IN ('billing', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only billing and admin users can update dealer GST';
  END IF;

  -- Update dealer GST number
  UPDATE public.dealers
  SET gst_number = p_gst_number
  WHERE id = p_dealer_id
  RETURNING * INTO v_updated_row;

  -- Return result
  RETURN json_build_object(
    'success', true,
    'message', 'GST number updated successfully',
    'gst_number', v_updated_row.gst_number
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_dealer_gst TO authenticated;

COMMENT ON FUNCTION public.update_dealer_gst IS 'Update dealer GST number - allows billing and admin users to modify dealer information';
