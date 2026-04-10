# Database Backup & Migration System

Complete system for backing up and migrating your Supabase database to another instance with **zero reconfiguration** of RLS policies, users, authentication, or other settings.

## 🎯 What This System Does

This comprehensive backup and migration solution allows you to:

- ✅ **Export everything** - Schema, policies, users, auth, and all data
- ✅ **Migrate completely** - Move to new Supabase instance in ~2 hours
- ✅ **No reconfiguration needed** - All RLS policies, users, and roles work immediately
- ✅ **Preserve relationships** - Foreign keys, sequences, indexes all maintained
- ✅ **Full validation** - Automated checks to ensure data integrity
- ✅ **Easy rollback** - Keep original instance for 7 days as fallback

## 📁 Files in This Directory

### Core Documentation
- **[README.md](README.md)** - Main guide with overview and quick start
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Command cheat sheet for quick migration
- **[migration_checklist.md](migration_checklist.md)** - Detailed step-by-step process
- **[troubleshooting.md](troubleshooting.md)** - Solutions to common issues

### SQL Export Scripts
- **[export_schema_policies.sql](export_schema_policies.sql)** - Exports tables, functions, triggers, and RLS policies
- **[export_users_auth.sql](export_users_auth.sql)** - Exports users, roles, and authentication data
- **[export_application_data.sql](export_application_data.sql)** - Exports all application records

### Automation Tools
- **[post_migration_fixes.sql](post_migration_fixes.sql)** - Validation and cleanup after import
- **[migrate-database.ps1](migrate-database.ps1)** - PowerShell automation script for Windows

---

## 🚀 Quick Start (2 hours)

### Overview Timeline

```
Preparation        15 min   ├─ Backup current database
                            ├─ Collect credentials
                            └─ Review settings
                    
Export              20 min   ├─ Export schema & policies
                            ├─ Export users & auth
                            └─ Export application data

Create New          10 min   └─ Create new Supabase project

Import              30 min   ├─ Import schema (10 min)
                            ├─ Import users (5 min)
                            └─ Import data (15 min)

Validate            10 min   ├─ Run validation script
                            ├─ Check data counts
                            └─ Verify RLS policies

Configure           5 min    └─ Update .env.local

Test                15 min   ├─ Test login
                            ├─ Verify data access
                            └─ Check RLS policies

TOTAL:             ~2 hours
```

### Manual Commands

```bash
# Change to this directory
cd database-backup

# 1. EXPORT (from old database)
psql "postgresql://postgres:PASSWORD@OLD-ID.supabase.co:5432/postgres" \
  -f export_schema_policies.sql > schema_export.sql

psql "postgresql://postgres:PASSWORD@OLD-ID.supabase.co:5432/postgres" \
  -f export_users_auth.sql > users_export.sql

psql "postgresql://postgres:PASSWORD@OLD-ID.supabase.co:5432/postgres" \
  -f export_application_data.sql > data_export.sql

# 2. CREATE new project at https://supabase.com/dashboard

# 3. IMPORT (to new database)
psql "postgresql://postgres:PASSWORD@NEW-ID.supabase.co:5432/postgres" < schema_export.sql
psql "postgresql://postgres:PASSWORD@NEW-ID.supabase.co:5432/postgres" < users_export.sql
psql "postgresql://postgres:PASSWORD@NEW-ID.supabase.co:5432/postgres" < data_export.sql

# 4. VALIDATE
psql "postgresql://postgres:PASSWORD@NEW-ID.supabase.co:5432/postgres" < post_migration_fixes.sql
```

### PowerShell Automation (Windows)

```powershell
# Run the automated migration script
.\migrate-database.ps1 `
  -SourceProjectID "your-old-project-id" `
  -TargetProjectID "your-new-project-id" `
  -Password "your-database-password"
```

### Update Application

```env
# .env.local
VITE_SUPABASE_URL=https://[NEW-PROJECT-ID].supabase.co
VITE_SUPABASE_ANON_KEY=new-anon-key-from-dashboard
```

---

## 📊 What Gets Migrated

### Database Structure
- ✅ All tables with constraints
- ✅ All indexes for performance
- ✅ All sequences and auto-increment
- ✅ All custom types and enums
- ✅ All PostgreSQL extensions

### Security & Access Control
- ✅ All RLS policies
- ✅ All trigger functions
- ✅ All RPC functions
- ✅ User roles and permissions
- ✅ Role-based access controls

### Users & Authentication
- ✅ All auth.users records
- ✅ User profiles and metadata
- ✅ Email confirmations
- ✅ User sessions
- ✅ MFA/2FA factors
- ✅ Linked identities

### Application Data
- ✅ All customer/dealer records
- ✅ All product catalogs
- ✅ All orders and transactions
- ✅ All payment records
- ✅ All inventory data
- ✅ All audit logs
- ✅ Created/updated timestamps

### NOT Migrated
- ❌ Storage buckets (files) - migrate separately
- ❌ API keys/tokens - regenerate as needed
- ❌ Secrets and environment variables - manage in deployment

---

## 🔍 How Each File Works

### export_schema_policies.sql
Extracts schema information:
```
├─ Custom types and enums
├─ Table definitions
├─ Indexes and constraints
├─ Foreign key relationships
├─ RLS policies (full definitions)
├─ Functions and triggers
└─ Permission grants
```

### export_users_auth.sql
Extracts user and authentication data:
```
├─ Roles and role assignments
├─ auth.users with encrypted passwords
├─ User profiles with all metadata
├─ MFA/2FA configurations
├─ Linked identities (OAuth)
└─ Active sessions
```

### export_application_data.sql
Extracts all business data:
```
├─ Products and catalogs
├─ Dealers and customers
├─ Orders and order details
├─ Payments and transactions
├─ Inventory and stock
├─ Activity audit logs
└─ All relationships preserved
```

### post_migration_fixes.sql
Validates and fixes after import:
```
├─ Reset sequences to correct values
├─ Verify all tables imported
├─ Check foreign key integrity
├─ Confirm RLS policies active
├─ Validate user data
├─ Generate migration report
└─ Provide next steps
```

---

## 🎓 Learning Path

### If you're new to this:
1. Start with **[README.md](README.md)** for overview
2. Read **[migration_checklist.md](migration_checklist.md)** for details
3. Follow the step-by-step instructions
4. Reference **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** while executing

### If you're experienced:
1. Review **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** for commands
2. Run **[migrate-database.ps1](migrate-database.ps1)** for automation
3. Check **[troubleshooting.md](troubleshooting.md)** if issues arise

### If something goes wrong:
1. Check **[troubleshooting.md](troubleshooting.md)** for common issues
2. Review **[migration_checklist.md](migration_checklist.md)** step details
3. Search error message in troubleshooting guide
4. Run diagnostic commands provided

---

## ⚙️ System Requirements

### Required
- PostgreSQL client tools (psql)
  - Windows: https://www.postgresql.org/download/windows/
  - Mac: `brew install postgresql`
  - Linux: `sudo apt install postgresql-client`

### Optional
- PowerShell 5.1+ (for automated migration on Windows)
- Text editor (to review .sql files)
- ~50MB disk space for exports (depends on data size)

### Access Required
- Source Supabase database credentials (password)
- Target Supabase database credentials (password)
- Supabase dashboard access to create new project

---

## 🔒 Security Notes

### During Migration
- Export files contain encrypted passwords and user data
- Store exports securely
- Don't commit to version control
- Delete exports after successful migration
- Consider encrypting exports for transfer

### After Migration
- Update any API keys/tokens as needed
- Rotate JWT secrets if using custom auth
- Update CORS settings in new project
- Update webhooks if configured
- Test with production-like data first

---

## 🆘 Getting Help

### Quick Answers
1. Check **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** for commands
2. Search **[troubleshooting.md](troubleshooting.md)** for common issues
3. Review **[migration_checklist.md](migration_checklist.md)** for step details

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Can't connect to database | Check password, project ID, and firewall settings |
| Export file is empty | Verify user permissions and table access |
| Import fails on FK constraints | Run with `SET session_replication_role = 'replica'` |
| Users can't login after migration | Verify users were imported, check email matches |
| RLS policies not working | Run `ALTER TABLE table ENABLE ROW LEVEL SECURITY;` |
| Sequences giving duplicate key errors | Run post_migration_fixes.sql to reset sequences |

### Getting Support

If you need help:
1. Gather error message (exact text)
2. Try diagnostic commands from troubleshooting guide
3. Review relevant .md file for your issue
4. Contact Supabase support with anonymized export file

---

## 📋 Pre-Migration Checklist

- [ ] Create backup in Supabase dashboard (Settings → Backups)
- [ ] Collect source database password
- [ ] Verify you have psql installed
- [ ] Create new Supabase project
- [ ] Collect new database password
- [ ] Note both Project IDs
- [ ] Have .env.local ready to update
- [ ] Plan for 2 hours of migration time
- [ ] Have rollback plan for first 7 days

---

## 📈 What's Included

```
database-backup/
├── README.md                          # Main documentation & overview
├── QUICK_REFERENCE.md                 # Command cheat sheet
├── migration_checklist.md             # Detailed step-by-step guide
├── troubleshooting.md                 # Common issues & solutions
├── export_schema_policies.sql         # Export schema & RLS
├── export_users_auth.sql              # Export users & auth
├── export_application_data.sql        # Export application data
├── post_migration_fixes.sql           # Validation & fixes
├── migrate-database.ps1               # PowerShell automation
└── INDEX.md                           # This file
```

---

## 🎯 Success Looks Like

After migration you should see:
- ✅ All tables exist in new database
- ✅ All data counts match original
- ✅ Users can login with same credentials
- ✅ Dealers see correct data (RLS working)
- ✅ RLS policies enforced per role
- ✅ New orders can be created
- ✅ Payments record correctly
- ✅ No console errors in application
- ✅ Performance similar to original
- ✅ Backups running on new instance

---

## 🔄 When to Use This System

### Use this for:
- ✅ Moving database to new Supabase project
- ✅ Testing database in staging environment
- ✅ Creating backup for disaster recovery
- ✅ Migrating between cloud regions
- ✅ Transferring customer data (with permission)
- ✅ Setting up development environment from production data

### Don't use for:
- ❌ Selective data transfer (use targeted exports instead)
- ❌ Real-time synchronization (use replication instead)
- ❌ Large-scale transformations (use ETL tools instead)
- ❌ Public data backups (encrypt first)
- ❌ Compliance-critical migrations (use Supabase professional services)

---

## 📞 Next Steps

1. **Read the full guide:** [README.md](README.md)
2. **Plan your migration:** [migration_checklist.md](migration_checklist.md)
3. **Execute migration:** Use PowerShell script or manual commands
4. **Fix any issues:** [troubleshooting.md](troubleshooting.md)
5. **Update application:** Change .env.local and restart

---

**Good luck with your migration! 🚀**

For questions or issues, refer to the comprehensive documentation included in this directory.
