-- DIAGNOSTIC: CHECK WHY UPDATES ARE FAILING DESPITE CORRECT POLICIES
-- This checks table grants, triggers, and other blocking factors

-- Step 1: Check table grants for authenticated role
SELECT 
  grantee,
  privilege_type,
  table_name,
  is_grantable
FROM role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('spartan', 'fightor')
ORDER BY table_name, privilege_type;

-- Step 2: Check for triggers that might be blocking updates
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('spartan', 'fightor')
ORDER BY event_object_table, trigger_name;

-- Step 3: Check if there are any NOT NULL constraints that might block updates
SELECT 
  column_name,
  is_nullable,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'spartan'
ORDER BY ordinal_position;

-- Step 4: Check column constraints
SELECT 
  table_name,
  column_name,
  constraint_name,
  constraint_type
FROM information_schema.constraint_column_usage
WHERE table_schema = 'public'
  AND table_name IN ('spartan', 'fightor')
ORDER BY table_name, column_name;

-- Step 5: Test a simple update query to see exact error
-- (This will fail, but shows the error message)
-- UNCOMMENT TO TEST:
-- UPDATE public.spartan 
-- SET status = 'test' 
-- WHERE id = 'test-id'
-- RETURNING id, status;

-- Step 6: Check role memberships for authenticated users
SELECT 
  member.rolname as user_role,
  admin.rolname as admin_role
FROM pg_auth_members
JOIN pg_roles member ON member.oid = pg_auth_members.member
JOIN pg_roles admin ON admin.oid = pg_auth_members.roleid
WHERE member.rolname IN ('authenticated', 'anon', 'service_role');

-- Step 7: Check for column-level security
SELECT 
  table_name,
  column_name,
  privilege_type,
  grantee
FROM role_column_grants
WHERE table_schema = 'public'
  AND table_name IN ('spartan', 'fightor');
