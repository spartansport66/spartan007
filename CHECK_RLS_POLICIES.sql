-- CHECK ROW LEVEL SECURITY POLICIES ON SPARTAN AND FIGHTOR TABLES
-- This will show what policies are currently blocking or allowing updates

-- 1. Check if RLS is enabled on the tables
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('spartan', 'fightor')
  AND schemaname = 'public';

-- 2. Check all policies on spartan and fightor tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('spartan', 'fightor')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Check the current user and their role
SELECT 
  current_user,
  current_role,
  session_user;

-- 4. Check specific policy details for UPDATE operations
SELECT 
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.qual as select_check,
  p.with_check as update_insert_check
FROM pg_policies p
WHERE p.tablename IN ('spartan', 'fightor')
  AND p.schemaname = 'public'
  AND p.cmd IN ('UPDATE', '*');

-- 5. If policies exist, show their definitions
SELECT 
  pc.relname as table_name,
  pol.polname as policy_name,
  pol.polkind as policy_kind,
  pg_get_expr(pol.polqual, pc.oid) as qual_expression,
  pg_get_expr(pol.polwithcheck, pc.oid) as with_check_expression
FROM pg_policy pol
JOIN pg_class pc ON pc.oid = pol.polrelid
JOIN pg_namespace pn ON pn.oid = pc.relnamespace
WHERE pn.nspname = 'public'
  AND pc.relname IN ('spartan', 'fightor')
ORDER BY pc.relname, pol.polname;
