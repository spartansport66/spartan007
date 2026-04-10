# Database Migration Quick Reference

**Complete database migration between Supabase instances in ~2 hours**

## Prerequisites

```bash
# Install PostgreSQL client tools (if not already installed)
# Windows: https://www.postgresql.org/download/windows/
# Mac: brew install postgresql
# Linux: sudo apt install postgresql-client
```

## Step 1: Collect Credentials (5 min)

### Source Database
- **Project ID:** ___________________________
- **Password:** ___________________________
- **Connection:** `postgresql://postgres:PASSWORD@PROJECT-ID.supabase.co:5432/postgres`

### New Database
- **Project ID:** ___________________________
- **Password:** ___________________________
- **Connection:** `postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres`

## Step 2: Export from Source (20 min)

```bash
# Save directory path
cd c:\Users\Admin\dyad-apps\spartan\database-backup

# Export 1: Schema & Policies
psql "postgresql://postgres:PASSWORD@SOURCE-ID.supabase.co:5432/postgres" \
  -f export_schema_policies.sql > schema_export.sql

# Export 2: Users & Auth
psql "postgresql://postgres:PASSWORD@SOURCE-ID.supabase.co:5432/postgres" \
  -f export_users_auth.sql > users_export.sql

# Export 3: Application Data
psql "postgresql://postgres:PASSWORD@SOURCE-ID.supabase.co:5432/postgres" \
  -f export_application_data.sql > data_export.sql
```

## Step 3: Verify Exports (5 min)

```bash
# Check file sizes
dir schema_export.sql users_export.sql data_export.sql

# Review contents
type schema_export.sql | more
```

## Step 4: Create New Project (10 min)

1. Go to: https://supabase.com/dashboard
2. Click "New Project"
3. Configure:
   - Name: `[ProjectName]-Migration`
   - Region: Same as original
   - Password: Generate strong password
4. Wait for "READY" status (2-5 minutes)
5. Note the new **Project ID**

## Step 5: Import to Target (30 min)

```bash
# Import 1: Schema & Policies (10 min)
psql "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres" \
  < schema_export.sql

# Verify tables created
psql "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres" \
  -c "\dt public.*" | head -20

# Import 2: Users & Auth (5 min)
psql "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres" \
  < users_export.sql

# Import 3: Application Data (15 min)
psql "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres" \
  < data_export.sql
```

## Step 6: Validate Import (10 min)

```bash
# Run validation script
psql "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres" \
  < post_migration_fixes.sql

# Check specific counts
psql "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres" \
  -c "SELECT tablename, COUNT(*) FROM (SELECT 'products'::text FROM products UNION ALL SELECT 'orders' FROM orders) AS t;"
```

## Step 7: Update Application (5 min)

### Update `.env.local`

```env
# OLD VALUES
VITE_SUPABASE_URL=https://SOURCE-ID.supabase.co
VITE_SUPABASE_ANON_KEY=old_key_here

# NEW VALUES
VITE_SUPABASE_URL=https://NEW-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=new_key_here
```

**How to get new key:**
1. Supabase Dashboard
2. New Project → Settings → API
3. Copy "anon" key under "Project API keys"

## Step 8: Test Application (10 min)

```bash
# Restart application
npm run dev

# Test in browser:
# [ ] Login with existing user
# [ ] View dealer list
# [ ] Create new order
# [ ] Check RLS policies work
```

---

## Troubleshooting Quick Fixes

| Issue | Command |
|-------|---------|
| Wrong password | `psql -h PROJECT-ID.supabase.co -U postgres -c "SELECT 1;"` |
| Table not found | `psql -h ... -c "\dt public.*"` |
| No users imported | `psql -h ... -c "SELECT COUNT(*) FROM auth.users;"` |
| Sequence error | `psql -h ... -f post_migration_fixes.sql` |
| Connection refused | Check `.env.local` PROJECT-ID and KEY |

## Common Commands

```bash
# List all tables
psql "postgresql://postgres:PASSWORD@PROJECT-ID.supabase.co:5432/postgres" \
  -c "\dt public.*"

# Count records
psql "postgresql://postgres:PASSWORD@PROJECT-ID.supabase.co:5432/postgres" \
  -c "SELECT COUNT(*) FROM products;"

# Check RLS policies
psql "postgresql://postgres:PASSWORD@PROJECT-ID.supabase.co:5432/postgres" \
  -c "SELECT tablename FROM pg_tables WHERE rowsecurity=true;"

# Verify users
psql "postgresql://postgres:PASSWORD@PROJECT-ID.supabase.co:5432/postgres" \
  -c "SELECT COUNT(*) FROM auth.users WHERE email NOT LIKE '%supabase%';"

# Fix sequences
psql "postgresql://postgres:PASSWORD@PROJECT-ID.supabase.co:5432/postgres" \
  -c "SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));"
```

## PowerShell Version (Windows)

```powershell
# Install if needed
choco install postgresql14

# Export
$SourceDB = "postgresql://postgres:PASSWORD@SOURCE-ID.supabase.co:5432/postgres"
$TargetDB = "postgresql://postgres:PASSWORD@NEW-PROJECT-ID.supabase.co:5432/postgres"

psql $SourceDB -f export_schema_policies.sql > schema_export.sql
psql $SourceDB -f export_users_auth.sql > users_export.sql
psql $SourceDB -f export_application_data.sql > data_export.sql

# Import
psql $TargetDB < schema_export.sql
psql $TargetDB < users_export.sql
psql $TargetDB < data_export.sql
psql $TargetDB < post_migration_fixes.sql
```

## Bash Script (macOS/Linux)

```bash
#!/bin/bash

SOURCE_ID="your-source-id"
TARGET_ID="your-target-id"
PASSWORD="your-password"

SOURCE_DB="postgresql://postgres:$PASSWORD@$SOURCE_ID.supabase.co:5432/postgres"
TARGET_DB="postgresql://postgres:$PASSWORD@$TARGET_ID.supabase.co:5432/postgres"

echo "Exporting..."
psql $SOURCE_DB -f export_schema_policies.sql > schema_export.sql
psql $SOURCE_DB -f export_users_auth.sql > users_export.sql
psql $SOURCE_DB -f export_application_data.sql > data_export.sql

echo "Importing..."
psql $TARGET_DB < schema_export.sql
psql $TARGET_DB < users_export.sql
psql $TARGET_DB < data_export.sql
psql $TARGET_DB < post_migration_fixes.sql

echo "Complete! Review results and update .env.local"
```

## Success Checklist

- [ ] All tables created in new database
- [ ] All data imported (counts match)
- [ ] Users can login
- [ ] RLS policies active
- [ ] Application updated with new URL/key
- [ ] UI loads without errors
- [ ] Dealer data visible
- [ ] Orders can be created
- [ ] Backups running on new instance
- [ ] Old instance kept as backup for 7 days

---

## File Reference

| File | Purpose |
|------|---------|
| `README.md` | Full overview and feature details |
| `export_schema_policies.sql` | Export schema and RLS policies |
| `export_users_auth.sql` | Export users and roles |
| `export_application_data.sql` | Export all application data |
| `post_migration_fixes.sql` | Validation and fixes |
| `migration_checklist.md` | Detailed step-by-step guide |
| `troubleshooting.md` | Common issues and solutions |
| `QUICK_REFERENCE.md` | This file (quick overview) |

---

**Need help?** See `troubleshooting.md` for common issues or consult `migration_checklist.md` for detailed steps.
