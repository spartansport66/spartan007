-- ============================================================================
-- EXPORT: USERS, ROLES, AND AUTHENTICATION DATA
-- ============================================================================
-- This script exports all user data, roles, and permission assignments
-- from the auth schema and profiles table
-- ============================================================================

-- ============================================================================
-- 1. EXPORT USER ROLES AND PERMISSIONS
-- ============================================================================

-- Export all custom roles
SELECT 'CREATE ROLE ' || quote_ident(rolname) || ' WITH ' ||
  CASE WHEN usecanlogin THEN 'LOGIN' ELSE 'NOLOGIN' END || 
  CASE WHEN usecreatedb THEN ' CREATEDB' ELSE '' END ||
  CASE WHEN usecancreerole THEN ' CREATEROLE' ELSE '' END || ';'
FROM pg_roles
WHERE rolname NOT IN ('postgres', 'pg_admin', 'pg_monitor', 'pg_database_owner', 'authenticated', 'anon', 'service_role')
AND rolname NOT LIKE 'pg_%';

-- ============================================================================
-- 2. EXPORT USER PROFILES
-- ============================================================================

-- Export user profile data (preserving UUIDs for FK relationships)
SELECT json_build_object(
  'user_id', id,
  'email', email,
  'user_full_name', user_full_name,
  'user_type', user_type,
  'user_role', user_role,
  'phone', phone,
  'is_active', is_active,
  'created_at', created_at,
  'updated_at', updated_at
)::text || ','
FROM public.profiles
ORDER BY created_at;

-- Alternative: Export as INSERT statements
SELECT 'INSERT INTO public.profiles (id, email, user_full_name, user_type, user_role, phone, is_active, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(email) || ', ' ||
  quote_literal(user_full_name) || ', ' ||
  quote_literal(user_type) || ', ' ||
  quote_literal(user_role) || ', ' ||
  quote_literal(phone) || ', ' ||
  is_active || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM public.profiles
ORDER BY created_at;

-- ============================================================================
-- 3. EXPORT AUTH USERS (Requires auth schema access)
-- ============================================================================

-- Export auth.users data - IMPORTANT: Only if you have direct access
-- This uses auth schema which may require special permissions
SELECT 'INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, last_sign_in_at, created_at, updated_at, role) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(email) || ', ' ||
  quote_literal(encrypted_password) || ', ' ||
  quote_literal(email_confirmed_at) || ', ' ||
  quote_literal(last_sign_in_at) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  quote_literal(role) ||
  ');'
FROM auth.users
WHERE email NOT LIKE '%supabase.com%'
ORDER BY created_at;

-- ============================================================================
-- 4. EXPORT USER METADATA
-- ============================================================================

-- Export user metadata
SELECT 'INSERT INTO auth.user_metadata (user_id, metadata) VALUES (' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(to_jsonb(raw_user_meta_data)) ||
  ');'
FROM auth.users
WHERE raw_user_meta_data IS NOT NULL
ORDER BY created_at;

-- ============================================================================
-- 5. EXPORT ROLE ASSIGNMENTS
-- ============================================================================

-- If using a user_roles junction table
SELECT 'INSERT INTO public.user_roles (user_id, role) VALUES (' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(role) ||
  ');'
FROM public.user_roles
ORDER BY user_id, role;

-- ============================================================================
-- 6. EXPORT AUTHENTICATION FACTORS
-- ============================================================================

-- Export MFA/2FA settings if you're using them
SELECT 'INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(friendly_name) || ', ' ||
  quote_literal(factor_type) || ', ' ||
  quote_literal(status) || ', ' ||
  quote_literal(created_at) ||
  ');'
FROM auth.mfa_factors
ORDER BY user_id, created_at;

-- ============================================================================
-- 7. EXPORT SESSIONS
-- ============================================================================

-- Export active sessions
SELECT 'INSERT INTO auth.sessions (id, user_id, created_at, updated_at, not_after, factor_id, aal) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ', ' ||
  quote_literal(not_after) || ', ' ||
  quote_literal(factor_id) || ', ' ||
  quote_literal(aal) ||
  ');'
FROM auth.sessions
ORDER BY user_id, created_at;

-- ============================================================================
-- 8. EXPORT IDENTITIES (Social login, email/password)
-- ============================================================================

-- Export linked identities
SELECT 'INSERT INTO auth.identities (id, user_id, identity_data, provider, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(user_id) || ', ' ||
  quote_literal(to_jsonb(identity_data)) || ', ' ||
  quote_literal(provider) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) ||
  ');'
FROM auth.identities
ORDER BY user_id, provider;

-- ============================================================================
-- 9. SUMMARY STATISTICS
-- ============================================================================

SELECT 'Users in auth schema:' AS metadata, COUNT(*) AS count FROM auth.users;
SELECT 'Users in profiles:' AS metadata, COUNT(*) AS count FROM public.profiles;
SELECT 'Active users:' AS metadata, COUNT(*) AS count FROM public.profiles WHERE is_active = TRUE;
SELECT 'Roles assigned:' AS metadata, COUNT(DISTINCT user_role) AS count FROM public.profiles;

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 1. Export this output to users_export.sql
-- 2. Review carefully - ensure no system users are included
-- 3. Apply to new database AFTER schema is created:
--    psql -h [new-host] -U postgres -d postgres < users_export.sql
-- 4. Verify all users are present in new database
-- ============================================================================
