# Troubleshooting Guide

Common issues and solutions for database migration between Supabase instances.

## Connection Issues

### Issue: "psql: could not translate host name"

**Symptoms:**
```
psql: could not translate host name "[PROJECT-ID].supabase.co" to address: Unknown host
```

**Causes:**
- Network connectivity issues
- Wrong project ID
- Typo in connection string
- Firewall blocking port 5432

**Solutions:**
1. Verify project ID
   - Check Supabase dashboard Settings → Database
   - Project ID should be 20 characters alphanumeric

2. Test connectivity
   ```bash
   ping [PROJECT-ID].supabase.co
   ```

3. Try with explicit port
   ```bash
   psql -h [PROJECT-ID].supabase.co -p 5432 -U postgres -d postgres
   ```

4. Check firewall
   - Verify port 5432 is open
   - Check if VPN is needed
   - Whitelist your IP in Supabase

### Issue: "password authentication failed"

**Symptoms:**
```
FATAL: password authentication failed for user "postgres"
```

**Causes:**
- Wrong database password
- Password copied with whitespace
- Special characters not escaped properly

**Solutions:**
1. Reset database password
   - Go to Supabase Dashboard
   - Settings → Database → Reset database password
   - Wait 2 minutes for reset to complete
   - Use new password in connection string

2. Escape special characters
   ```bash
   # If password has special characters, escape them
   psql "postgresql://postgres:p%40ssw0rd@[PROJECT-ID].supabase.co:5432/postgres"
   ```

3. Use .pgpass file (secure method)
   ```bash
   # Create ~/.pgpass on Linux/Mac or %APPDATA%\postgresql\pgpass.conf on Windows
   [PROJECT-ID].supabase.co:5432:postgres:postgres:your-password
   chmod 600 ~/.pgpass
   
   psql -h [PROJECT-ID].supabase.co -U postgres -d postgres
   ```

## Export Issues

### Issue: Export file is empty or very small

**Symptoms:**
- `schema_export.sql` is < 1KB
- `data_export.sql` has no INSERT statements
- File ends prematurely

**Causes:**
- Export script has syntax errors
- User doesn't have permission to read tables
- Query returned no results

**Solutions:**
1. Verify user permissions
   ```bash
   psql -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"
   ```

2. Check individual table contents
   ```bash
   psql -c "SELECT COUNT(*) FROM products;"
   psql -c "SELECT COUNT(*) FROM dealers;"
   ```

3. Try exporting just one table
   ```bash
   psql -c "SELECT * FROM products LIMIT 5;" > test_export.txt
   ```

4. Check for query timeouts
   - Large tables might timeout
   - Try exporting in smaller batches
   - Use `LIMIT` clause

### Issue: "ERROR: column ... does not exist"

**Symptoms:**
```
ERROR: column "combo_dp" does not exist
```

**Causes:**
- Column name changed in schema
- Using old export script with new schema
- Typo in export script

**Solutions:**
1. Check actual column names
   ```bash
   psql -c "\d products"
   ```

2. Update export script with correct names

3. Use generic export that discovers columns
   ```bash
   psql -c "SELECT * FROM products LIMIT 0;" > schema.sql
   ```

## Import Issues

### Issue: "relation ... already exists"

**Symptoms:**
```
ERROR: relation "products" already exists
```

**Causes:**
- Table already partly created
- Schema import ran twice
- New project wasn't empty

**Solutions:**
1. Drop conflicts and reimport
   ```bash
   psql -c "DROP TABLE IF EXISTS products CASCADE;"
   psql < schema_export.sql
   ```

2. Create completely new project
   - Delete current project
   - Create new empty project
   - Try import again

3. Check if table is empty
   ```bash
   psql -c "SELECT COUNT(*) FROM products;"
   ```

### Issue: "foreign key constraint violated"

**Symptoms:**
```
ERROR: insert or update on table "orders" violates foreign key constraint "orders_dealer_id_fkey"
```

**Causes:**
- Data imported in wrong order
- Referenced data doesn't exist
- NULL values in FK columns

**Solutions:**
1. Prepend to import script
   ```sql
   SET session_replication_role = 'replica';
   ```

2. Import data in correct order
   - Base tables first (products, dealers)
   - Then reference tables (orders, payments)
   - Then detail tables (order_details)

3. Append after import
   ```sql
   SET session_replication_role = 'origin';
   ANALYZE;
   ```

4. Manually fix problematic records
   ```bash
   # Find orphaned records
   psql -c "SELECT * FROM orders WHERE dealer_id NOT IN (SELECT id FROM dealers);"
   
   # Delete or fix them
   psql -c "DELETE FROM orders WHERE dealer_id NOT IN (SELECT id FROM dealers);"
   ```

### Issue: "ERROR: duplicate key value violates unique constraint"

**Symptoms:**
```
ERROR: duplicate key value violates unique constraint "products_product_code_key"
```

**Causes:**
- Duplicate data in source database
- UUID conflicts
- Import ran twice

**Solutions:**
1. Check for actual duplicates
   ```bash
   psql -c "SELECT product_code, COUNT(*) FROM products GROUP BY product_code HAVING COUNT(*) > 1;"
   ```

2. Remove duplicates from export file
   ```bash
   # Edit export to remove duplicate INSERT statements
   ```

3. Use INSERT ... ON CONFLICT for reimport
   ```sql
   INSERT INTO products VALUES (...) 
   ON CONFLICT (product_code) DO UPDATE SET ...;
   ```

### Issue: "ERROR: invalid UUID"

**Symptoms:**
```
ERROR: invalid input syntax for type uuid: "null"
```

**Causes:**
- NULL values exported as text "null"
- UUID format incorrect
- Quote issues in export

**Solutions:**
1. Check export file
   ```bash
   grep -i "null" data_export.sql | head
   ```

2. Fix NULL values in export
   ```bash
   sed -i "s/'null'/NULL/g" data_export.sql
   ```

3. Verify UUID format
   ```bash
   psql -c "SELECT id FROM products LIMIT 1;" 
   # Should be format: a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11
   ```

## User/Authentication Issues

### Issue: Users not imported

**Symptoms:**
- `SELECT COUNT(*) FROM auth.users;` returns 1 or 0
- Can't login in application
- auth.users table is empty

**Causes:**
- Users export script has errors
- No INSERT permissions for auth schema
- Export didn't include users

**Solutions:**
1. Check user count in source
   ```bash
   # In old database
   psql -c "SELECT COUNT(*) FROM auth.users WHERE email NOT LIKE '%supabase.com%';"
   ```

2. Check if import script has user data
   ```bash
   grep "INSERT INTO auth.users" users_export.sql | wc -l
   ```

3. Verify auth schema is accessible
   ```bash
   psql -c "SELECT * FROM auth.users LIMIT 1;"
   ```

4. Manually add test user
   ```bash
   psql -c "INSERT INTO auth.users (email) VALUES ('test@example.com');"
   ```

### Issue: "Permission denied" for auth schema

**Symptoms:**
```
ERROR: permission denied for schema auth
```

**Causes:**
- Using non-admin user
- Auth schema requires special access
- Service role limitations

**Solutions:**
1. Use correct user for import
   ```bash
   # Use postgres (admin) user, not service_role
   psql -U postgres (already the default)
   ```

2. Grant permissions if needed
   ```bash
   psql -c "GRANT ALL ON SCHEMA auth TO postgres;"
   psql -c "GRANT ALL ON ALL TABLES IN SCHEMA auth TO postgres;"
   ```

3. Verify user role
   ```bash
   psql -c "SELECT current_user;"
   # Should show: postgres
   ```

### Issue: "RLS policies preventing access"

**Symptoms:**
- Users can login but can't see data
- Orders table returns 0 rows
- "new row violates row-level security policy"

**Causes:**
- RLS policies recreated incorrectly
- Policies using wrong auth.uid()
- User ID mismatch between auth.users and profiles

**Solutions:**
1. Check if RLS is enabled
   ```bash
   psql -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename='orders';"
   ```

2. Temporarily disable RLS for testing
   ```bash
   psql -c "ALTER TABLE products DISABLE ROW LEVEL SECURITY;"
   ```

3. Verify user ID matches
   ```bash
   # In auth.users
   psql -c "SELECT id FROM auth.users WHERE email='user@example.com';"
   
   # In profiles
   psql -c "SELECT id FROM profiles WHERE email='user@example.com';"
   # Should be same UUID
   ```

4. Check policy definition
   ```bash
   psql -c "SELECT * FROM pg_policies WHERE tablename='orders';"
   ```

5. Re-enable and test
   ```bash
   psql -c "ALTER TABLE products ENABLE ROW LEVEL SECURITY;"
   ```

## Data Integrity Issues

### Issue: "Record counts don't match"

**Symptoms:**
- Source database: 500 products
- Target database: 483 products
- Missing data not found

**Causes:**
- Data not exported completely
- Foreign key constraint deleted records
- Records excluded intentionally in export script

**Solutions:**
1. Compare counts
   ```bash
   # Source database
   psql -c "SELECT tablename, COUNT(*) FROM (SELECT tablename FROM pg_tables) AS tables JOIN (SELECT count(*) FROM ...)"
   ```

2. Find missing records
   ```bash
   psql -c "SELECT id FROM products WHERE id NOT IN (SELECT product_id FROM order_details);"
   ```

3. Check for filters in export script
   - Some export scripts filter records
   - Check WHERE clauses
   - Verify LIMIT is appropriate

4. Re-export and reimport
   - Create fresh export
   - Clear incomplete import
   - Reimport complete data

### Issue: "Sequences not reset correctly"

**Symptoms:**
- New records create duplicate IDs
- "duplicate key value" on INSERT
- Auto-increment broken

**Causes:**
- Sequences weren't reset after import
- Sequence value is lower than max ID
- Sequence points to wrong table

**Solutions:**
1. Check sequence values
   ```bash
   psql -c "SELECT sequence_name, last_value FROM information_schema.sequences;"
   ```

2. Reset sequences manually
   ```bash
   psql -c "SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));"
   ```

3. Or use post-migration script
   ```bash
   psql < post_migration_fixes.sql
   ```

### Issue: "Timestamps off by timezone"

**Symptoms:**
- Dates are wrong time
- Created_at shows future dates
- Time is shifted by X hours

**Causes:**
- Timezone difference between systems
- Export using different timezone
- Timestamp without timezone lost zone info

**Solutions:**
1. Check column type
   ```bash
   psql -c "\d products" | grep created_at
   # Should show "timestamp with time zone"
   ```

2. Verify timezone setting
   ```bash
   psql -c "SHOW timezone;"
   ```

3. Convert during export
   ```sql
   -- Use AT TIME ZONE for conversions
   SELECT created_at AT TIME ZONE 'UTC' FROM products;
   ```

## Performance Issues

### Issue: "Import is very slow"

**Symptoms:**
- Import script taking hours
- CPU usage very high
- Disk I/O at 100%

**Causes:**
- Large dataset
- No batch optimization
- RLS policies slowing writes
- Indexes being updated in real-time

**Solutions:**
1. Disable indexes during import
   ```sql
   ALTER TABLE products DISABLE TRIGGER ALL;
   -- Import data
   ALTER TABLE products ENABLE TRIGGER ALL;
   ```

2. Increase work_mem
   ```bash
   psql -c "SET work_mem = '256MB';"
   ```

3. Batch imports into smaller chunks
   ```bash
   # Instead of 1 million rows:
   # Import 100,000 rows at a time
   ```

4. Disable constraints temporarily
   ```sql
   SET session_replication_role = 'replica';
   -- Import
   SET session_replication_role = 'origin';
   ANALYZE;
   ```

### Issue: "Application slow after migration"

**Symptoms:**
- Queries take 10x longer
- UI responses are slow
- Database load high

**Causes:**
- Missing indexes
- Outdated statistics
- Different hardware
- RLS policies not optimized

**Solutions:**
1. Rebuild indexes
   ```bash
   psql -c "REINDEX SCHEMA public;"
   psql -c "ANALYZE;"
   ```

2. Check query plans
   ```bash
   psql -c "EXPLAIN SELECT * FROM products;"
   ```

3. Add missing indexes
   ```bash
   psql -c "CREATE INDEX idx_products_active ON products(is_active);"
   ```

## Environment Configuration Issues

### Issue: "Connection refused" in application

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
Connection error: could not connect to database
```

**Causes:**
- Wrong Supabase URL in .env
- Old project ID
- API key mismatch
- Application using localhost

**Solutions:**
1. Update .env.local
   ```env
   VITE_SUPABASE_URL=https://[NEW-PROJECT-ID].supabase.co
   VITE_SUPABASE_ANON_KEY=[new-key]
   ```

2. Verify values
   ```bash
   # Get from Supabase dashboard
   # Settings → API → Project URL
   # Settings → API → anon (public) key
   ```

3. Restart application
   ```bash
   npm run dev
   ```

4. Check browser console for errors

### Issue: "Invalid API key"

**Symptoms:**
```
Error: Invalid API key
Unauthorized access
```

**Causes:**
- Wrong anon key
- Wrong service_role key
- Key was replaced
- Key copied incorrectly

**Solutions:**
1. Get correct key
   - Go to new project Settings → API
   - Copy exact key (with spaces at end)
   - Verify no extra characters

2. Update .env
   ```env
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

3. Verify app vs API
   - If using API call: use service_role key
   - If in browser/app: use anon key

4. Regenerate key if needed
   - Click "Rotate" in Supabase dashboard
   - Update all instances of old key

## Quick Diagnostic Script

Run this to diagnose issues:

```bash
#!/bin/bash

# Connection test
echo "=== Testing Connection ==="
psql -h [PROJECT-ID].supabase.co -U postgres -c "SELECT 1;" 2>&1

# Table count
echo "=== Table Count ==="
psql -h [PROJECT-ID].supabase.co -U postgres -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1

# Data samples
echo "=== Data Counts ==="
psql -h [PROJECT-ID].supabase.co -U postgres -c "
SELECT 'products' as table_name, COUNT(*) as count FROM products UNION ALL
SELECT 'dealers', COUNT(*) FROM dealers UNION ALL
SELECT 'orders', COUNT(*) FROM orders UNION ALL
SELECT 'profiles', COUNT(*) FROM public.profiles;
" 2>&1

# RLS check
echo "=== RLS Status ==="
psql -h [PROJECT-ID].supabase.co -U postgres -c "SELECT tablename FROM pg_tables WHERE rowsecurity=true;" 2>&1

# User count
echo "=== User Count ==="
psql -h [PROJECT-ID].supabase.co -U postgres -c "SELECT COUNT(*) FROM auth.users WHERE email NOT LIKE '%supabase.com%';" 2>&1
```

## Getting Help

If you can't resolve the issue:

1. **Check Supabase Status**
   - Visit https://status.supabase.com
   - Check for ongoing incidents

2. **Review Export/Import**
   - Re-run export script
   - Check for syntax errors in SQL files
   - Verify file wasn't corrupted

3. **Test with Smaller Data**
   - Try importing one table at a time
   - Narrow down which table has issues

4. **Contact Supabase Support**
   - Provide error message
   - Provide export file (anonymized)
   - Provide .env configuration

## Prevention Tips

To avoid issues in future migrations:

1. Always backup first
2. Test in staging environment
3. Verify exports before import
4. Use post-migration validation
5. Keep good documentation
6. Monitor first 24 hours
7. Have rollback plan ready
8. Test each major component
