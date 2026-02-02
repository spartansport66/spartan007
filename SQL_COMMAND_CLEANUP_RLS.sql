-- Drop the temporary debug policy
DROP POLICY IF EXISTS debug_allow_all_read ON public.dealers;

-- Re-create the original, more secure policy (if you remember it)
-- If not, you will need to create a new secure policy for authenticated users.