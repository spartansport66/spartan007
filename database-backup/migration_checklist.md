# Migration Checklist

Step-by-step guide to migrate your Supabase database to a new instance without reconfiguring policies, users, or authentication.

## Pre-Migration (Current Instance)

### Phase 1: Preparation (15 minutes)

- [ ] **Backup current database** (do this directly in Supabase dashboard)
  - Go to Settings → Backups
  - Create a new backup
  - Store the backup securely
  
- [ ] **Collect connection credentials**
  - Current Supabase Project ID
  - Current database password (from database settings)
  - Verify you have pgAdmin or psql access

- [ ] **Note all custom settings**
  - Check for any RLS policy exceptions
  - Document any custom JWT secrets
  - Document any API key configurations

- [ ] **Review application configuration**
  - Current `.env.local` settings
  - API endpoints being used
  - Custom headers or authentication flow

### Phase 2: Export from Current Instance (20 minutes)

- [ ] **Export Schema & Policies**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres" \
    --file database-backup/export_schema_policies.sql > schema_export.sql
  ```
  - Review the output file
  - Verify all tables are listed
  - Check RLS policies are included

- [ ] **Export Users & Authentication**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres" \
    --file database-backup/export_users_auth.sql > users_export.sql
  ```
  - Review user count
  - Verify all roles are present
  - Check for system accounts that shouldn't be exported

- [ ] **Export Application Data**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres" \
    --file database-backup/export_application_data.sql > data_export.sql
  ```
  - Check file size (should be reasonable)
  - Verify all INSERT statements are present
  - Note the total number of records

### Phase 3: Verification of Exports (10 minutes)

- [ ] **Verify schema_export.sql**
  - Contains CREATE TABLE statements
  - Contains CREATE POLICY statements
  - Contains CREATE FUNCTION statements
  - Contains all indexes

- [ ] **Verify users_export.sql**
  - Contains user INSERT statements
  - No system users (like postgres or supabase_admin)
  - All user metadata is present

- [ ] **Verify data_export.sql**
  - Contains INSERT statements for all tables
  - Contains SET session_replication_role at start/end
  - No NULL value errors visible

- [ ] **Backup export files**
  - Copy all three SQL files to secure location
  - Store with date stamp: `schema_export_2026-03-31.sql`

## New Instance Setup

### Phase 1: Create New Supabase Project (10 minutes)

- [ ] **Create new project in Supabase**
  - Go to https://supabase.com/dashboard
  - Click "New Project"
  - Give it a name: `[ProjectName]-Migration`
  - Select same region as old project
  - Note the new Project ID
  - Set database password (save it securely)

- [ ] **Wait for project initialization**
  - Takes 2-5 minutes
  - Project status should show "READY"

- [ ] **Collect new credentials**
  - New Project ID: `_________________`
  - New database password: `_________________`
  - Connection string: `postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres`

- [ ] **Verify connectivity**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" -c "SELECT 1 as connection_test;"
  ```
  - Should return: `1`
  - If fails, check password and project ID

### Phase 2: Import Schema & Policies (10 minutes)

- [ ] **Clean up export file before import**
  - Open `schema_export.sql`
  - Remove any syntax errors
  - Verify NO DROP statements are present (unless intentional)

- [ ] **Import schema**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    < schema_export.sql
  ```
  - Monitor for errors
  - Some warnings are OK (e.g., "role already exists")
  
- [ ] **Verify schema import**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "\dt public.*"
  ```
  - Should list all your tables
  - Should include product_combos, dealers, orders, etc.

- [ ] **Verify RLS is enabled**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT tablename FROM pg_tables WHERE rowsecurity = true;"
  ```
  - Should list all your application tables
  - Confirms RLS policies are active

### Phase 3: Import Users & Roles (15 minutes)

- [ ] **Prepare users export**
  - Review `users_export.sql`
  - Remove any test users you don't want
  - Verify password hashes are included

- [ ] **Import users**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    < users_export.sql
  ```
  - Watch for any errors
  - Most warnings can be ignored

- [ ] **Verify user import**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT COUNT(*) as user_count FROM auth.users WHERE email NOT LIKE '%supabase.com%';"
  ```
  - Should match your original user count

- [ ] **Verify profiles table**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT COUNT(*) as active FROM public.profiles WHERE is_active = TRUE;"
  ```
  - Should show your active user count
  - Should match original database

### Phase 4: Import Application Data (20 minutes)

- [ ] **Disable foreign key constraints (optional but recommended)**
  - If import fails due to FK constraints, prepend this to data_export.sql:
    ```sql
    SET session_replication_role = 'replica';
    ```

- [ ] **Import data**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    < data_export.sql
  ```
  - This may take several minutes
  - Watch for any errors

- [ ] **Re-enable foreign key constraints**
  - If you disabled them, run at end of import:
    ```bash
    psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
      -c "SET session_replication_role = 'origin';"
    ```

- [ ] **Verify data import counts**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT 'products' as table_name, COUNT(*) as count FROM products UNION ALL
        SELECT 'dealers', COUNT(*) FROM dealers UNION ALL
        SELECT 'orders', COUNT(*) FROM orders UNION ALL
        SELECT 'order_details', COUNT(*) FROM order_details;"
  ```
  - Compare with original database counts

### Phase 5: Run Post-Migration Fixes (10 minutes)

- [ ] **Run validation script**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    < database-backup/post_migration_fixes.sql
  ```

- [ ] **Review validation output**
  - Check migration_validation table
  - Verify all row counts match
  - Confirm no orphaned records

- [ ] **Check for foreign key violations**
  - Script will show any orphaned records
  - Manually fix if found (shouldn't be any)

## Application Configuration

### Phase 1: Update Environment Variables (5 minutes)

- [ ] **Update .env.local**
  ```env
  VITE_SUPABASE_URL=https://[NEW-PROJECT-ID].supabase.co
  VITE_SUPABASE_ANON_KEY=[new-anon-key-from-dashboard]
  ```
  
- [ ] **Get new API keys**
  - Go to new project Settings → API
  - Copy "anon" key
  - Copy "service_role" key if needed

- [ ] **Update any other configuration**
  - Check for hardcoded URLs in code
  - Update any backup/export scripts
  - Update CI/CD environment variables

### Phase 2: Test Application (15 minutes)

- [ ] **Stop current application**
  - Kill running dev server if any

- [ ] **Start application with new credentials**
  ```bash
  npm run dev
  ```

- [ ] **Test login functionality**
  - Login with existing user account
  - Should succeed with migrated credentials
  - Sessions should work correctly

- [ ] **Test data access**
  - View dealer list
  - Should show migrated dealer data
  - Should respect RLS policies per user role

- [ ] **Test create operations**
  - Try creating a new order
  - Should work and save to new database
  - Should apply RLS policies correctly

- [ ] **Test update operations**
  - Try updating an existing record
  - Verify changes save correctly
  - Check RLS policies prevent unauthorized changes

- [ ] **Test delete operations**
  - Try deleting a record (if appropriate)
  - Should respect RLS policies
  - Should prevent unauthorized deletions

### Phase 3: Smoke Tests (10 minutes)

- [ ] **Test file uploads** (if applicable)
  - Upload a file
  - Verify it's stored in correct bucket
  - Verify permissions are correct

- [ ] **Test reports/exports** (if applicable)
  - Generate a report
  - Check data accuracy
  - Verify date formatting

- [ ] **Test payment/transaction features** (if applicable)
  - Create a transaction
  - Verify amounts are correct
  - Check ledger updates

- [ ] **Test search functionality**
  - Search for a dealer
  - Search for a product
  - Verify results are correct

- [ ] **Test filtering and sorting**
  - Filter orders by date range
  - Sort by different columns
  - Verify results are accurate

- [ ] **Test user roles and permissions**
  - Logout and login as different user role
  - Verify each role sees correct data
  - Verify role-based restrictions work

## Final Verification

### Phase 1: Data Integrity (10 minutes)

- [ ] **Run data validation queries**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT COUNT(*) FROM products WHERE unit_dp IS NULL;"
  ```
  - Should show 0 NULL values (or expected count)

- [ ] **Verify referential integrity**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT COUNT(*) FROM orders WHERE dealer_id NOT IN (SELECT id FROM dealers);"
  ```
  - Should show 0 orphaned records

- [ ] **Check for missing sequence resets**
  - Create new record and check ID doesn't conflict
  - Should auto-increment correctly

### Phase 2: Performance (10 minutes)

- [ ] **Run heavy database query**
  - Load large report
  - Check response time
  - Should be similar to original

- [ ] **Monitor database size**
  ```bash
  psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
    -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
  ```
  - Should match original database size

- [ ] **Check index performance**
  - Run a search that uses indexes
  - Should return results quickly

### Phase 3: Backup Old Instance Decision (5 minutes)

- [ ] **Decide on old instance**
  - Option A: Keep running for X days as fallback
  - Option B: Delete immediately
  - Option C: Export data for archival

- [ ] **Document decision**
  - Note date of migration
  - Record what happened to old instance
  
- [ ] **If deleting old instance**
  - Export final backup from Supabase dashboard
  - Store backup securely for 12 months
  - Delete empty project

## Post-Migration Tasks

### Phase 1: Monitoring (Ongoing)

- [ ] **Monitor application errors**
  - Check error logs daily for first week
  - Look for database connection issues

- [ ] **Monitor database performance**
  - Check query response times
  - Monitor database size growth

- [ ] **Monitor user activity**
  - Verify all users can access system
  - Check for permission issues

### Phase 2: Documentation (Throughout)

- [ ] **Document any issues found**
  - Record what went wrong
  - Record how it was fixed

- [ ] **Update internal documentation**
  - Update wiki with new Project ID
  - Update runbooks with new credentials

- [ ] **Create rollback plan** (for this week only)
  - Document how to switch back if needed
  - Save old database credentials

### Phase 3: Cleanup (After 1 week)

- [ ] **Delete export SQL files** (if not needed)
  - Remove from local filesystem
  - Remove any temporary backups

- [ ] **Verify backups are running**
  - Check Supabase backup schedule
  - Verify new backups are being created

- [ ] **Update disaster recovery plan**
  - New Supabase Project ID in DR docs
  - New backup location if applicable

## Troubleshooting

### Issue: "Permission denied" during import

**Solution:**
- Verify database password
- Check username is 'postgres'
- Verify connection string format

### Issue: "table already exists" error

**Solution:**
- Schema was partially created
- Delete entire new project and start over
- OR manually drop conflicting tables first

### Issue: Foreign key constraint violations

**Solution:**
```bash
# Prepend to data_export.sql
SET session_replication_role = 'replica';

# Run import

# Append to data_export.sql
SET session_replication_role = 'origin';
ANALYZE;
```

### Issue: RLS policies not working after migration

**Solution:**
- Verify policies are shown: `SELECT * FROM pg_policies;`
- Check if RLS is enabled: `SELECT rowsecurity FROM pg_tables;`
- Run: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`

### Issue: Users can't login

**Solution:**
- Verify users were imported: `SELECT COUNT(*) FROM auth.users;`
- Check user email matches
- Verify JWT secret matches deployment
- Test with admin user first

### Issue: Data missing after import

**Solution:**
- Check migration_validation table for counts
- Verify import completed without errors
- Check if records were deleted by FK constraints
- Review post_migration_fixes.sql output

## Rollback Plan

If something goes wrong, you can switch back:

1. Update `.env.local` with old Supabase credentials
2. Restart application
3. Investigate issues with new database

**Note:** You have until day 7 to rollback. After that, delete old instance backups are safe (kept by Supabase).

## Success Criteria

Migration is successful when:

- ✅ All users can login
- ✅ All dealer data is visible
- ✅ All orders are present
- ✅ All payments are recorded
- ✅ RLS policies work correctly
- ✅ File uploads work (if applicable)
- ✅ Reports generate correctly
- ✅ No console errors
- ✅ Performance is similar to original
- ✅ Backups are running

## Timeline Summary

| Phase | Time | Task |
|-------|------|------|
| Prep | 15 min | Backup, collect credentials |
| Export | 20 min | Export schema, users, data |
| Verify Export | 10 min | Review exported files |
| Create New | 10 min | Create new Supabase project |
| Import Schema | 10 min | Import schema and policies |
| Import Users | 15 min | Import users and roles |
| Import Data | 20 min | Import application data |
| Post-Fix | 10 min | Run validation scripts |
| Config | 5 min | Update environment variables |
| Test | 15 min | Test application features |
| Verify | 10 min | Final data integrity checks |
| **TOTAL** | **~2 hours** | Full migration |

Good luck with your migration! 🚀
