# Database Backup & Migration Guide

Complete solution for backing up and migrating your Supabase database to another instance without reconfiguring RLS policies, users, authentication, and other details.

## 📋 Overview

This backup system captures:
- ✅ Database schema (tables, functions, triggers)
- ✅ Row Level Security (RLS) policies
- ✅ User roles and permissions
- ✅ Authentication users
- ✅ All application data
- ✅ Custom types, enums, and extensions

## 🚀 Quick Start

### Step 1: Export from Current Supabase Instance

```bash
# 1. Export schema and policies
psql "postgresql://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres" \
  --file export_schema_policies.sql > schema_export.sql

# 2. Export users and auth data
psql "postgresql://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres" \
  --file export_users_auth.sql > users_export.sql

# 3. Export application data
psql "postgresql://postgres:[PASSWORD]@[PROJECT-ID].supabase.co:5432/postgres" \
  --file export_application_data.sql > data_export.sql
```

### Step 2: Prepare New Supabase Instance

1. Create new Supabase project
2. Get new database credentials
3. Note the new `[NEW-PROJECT-ID]`

### Step 3: Import to New Instance

```bash
# 1. Create schema and policies
psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
  < schema_export.sql

# 2. Import users and roles
psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
  < users_export.sql

# 3. Import application data
psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
  < data_export.sql

# 4. Run post-migration fixes
psql "postgresql://postgres:[PASSWORD]@[NEW-PROJECT-ID].supabase.co:5432/postgres" \
  < post_migration_fixes.sql
```

## 📁 Files in This Directory

| File | Purpose |
|------|---------|
| `README.md` | This file - overview and quick start |
| `export_schema_policies.sql` | Exports schema and RLS policies |
| `export_users_auth.sql` | Exports users and role assignments |
| `export_application_data.sql` | Exports all application data |
| `post_migration_fixes.sql` | Fixes and validations after import |
| `migration_checklist.md` | Step-by-step migration guide |
| `troubleshooting.md` | Common issues and solutions |

## 🔑 Key Features

### Complete User Data Preservation
- Exports user IDs (preserves foreign key relationships)
- Exports email, roles, permissions
- Exports user metadata

### Full RLS Policy Export
- All row-level security policies
- Trigger functions
- Custom RLS logic

### Zero Reconfiguration Migration
- Once imported, no need to:
  - Reset RLS policies
  - Reconfigure user roles
  - Update authentication settings
  - Modify function logic

### Data Integrity
- Foreign key constraints preserved
- Enum types recreated
- UUID relationships maintained
- Created/Updated timestamps preserved

## ⚠️ Important Notes

1. **Database Connection**: You'll need the database password and connection details
2. **Authentication Token**: If using JWT tokens or API keys, you may need to rotate them
3. **Environment Variables**: Update `.env.local` with new Supabase URL and Key
4. **Backup First**: Always backup the target database before importing
5. **Test Environment**: Try migration in staging environment first

## 📊 Migration Order

The scripts should be run in this order:

```
1. Schema & Policies (creates structure)
   ↓
2. Users & Auth (creates users and role assignments)
   ↓
3. Application Data (inserts actual data)
   ↓
4. Post-Migration Fixes (validation and cleanup)
```

## 🔄 What Gets Migrated

### Database Schema
- All tables with indexes
- All functions (RPC functions)
- All triggers
- All custom types and enums
- All extensions (uuid-ossp, pgcrypto, etc.)

### Security & Permissions
- All RLS policies
- User roles (admin, sales, warehouse_keeper, etc.)
- Permission assignments
- Role-based access controls

### Application Data
- All customer/dealer data
- All product data
- All order data
- All transaction history
- All user profiles

### Configuration
- DateTime formats
- Constraints and validations
- Default values
- Sequences and auto-increment values

## ⏱️ Estimated Time

- Export: 5-15 minutes (depending on data volume)
- Import: 10-20 minutes
- Validation: 5 minutes
- **Total: ~30-50 minutes**

## 🆘 Support

If you encounter issues:
1. Check `troubleshooting.md`
2. Review `migration_checklist.md` for step-by-step guidance
3. Verify database credentials
4. Ensure sufficient disk space for exports
5. Check network connectivity to Supabase

## 🔐 Security Considerations

- Store export files securely (they contain user data)
- Use strong database passwords
- Consider encrypting export files when transferring
- Don't commit export files to version control
- Delete old export files after successful migration
