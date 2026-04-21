-- GRANT PROPER PERMISSIONS FOR UPDATES
-- Run this if the policies exist but updates are still blocked

-- Step 1: Grant necessary permissions to authenticated role on spartan table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spartan TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spartan TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spartan TO service_role;

-- Step 2: Grant necessary permissions to authenticated role on fightor table
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fightor TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fightor TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fightor TO service_role;

-- Step 3: Grant usage on sequences (if any) for auto-increment columns
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 4: Verify grants were applied
SELECT 
  table_name,
  privilege_type,
  grantee
FROM role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('spartan', 'fightor')
ORDER BY table_name, grantee, privilege_type;

-- Step 5: Alternative - Check what the actual authenticated user can do
-- Run this as the application user
SELECT current_user, current_role;

-- Step 6: Try a test update (will show specific error if permissions are still blocked)
-- DO $$
-- BEGIN
--   UPDATE public.spartan SET status = 'test' WHERE id = (SELECT id FROM public.spartan LIMIT 1) RETURNING id, status;
--   EXCEPTION WHEN OTHERS THEN
--     RAISE NOTICE 'Error: %', SQLERRM;
-- END $$;
