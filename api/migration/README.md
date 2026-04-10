# 🚀 Supabase Auto-Migration System (API-Based)

Complete API-based migration solution that transfers ALL Supabase data without using passwords.

## ✨ Features

- ✅ **API-based authentication** - No database passwords in plain text
- ✅ **Complete data migration** - All tables, data, and metadata
- ✅ **RLS policies** - Automatic RLS policy migration
- ✅ **Users & roles** - Migrate authentication users and custom roles
- ✅ **Storage buckets** - Migrate storage configuration
- ✅ **Database functions** - Automatically recreate custom functions
- ✅ **Triggers** - Migrate all database triggers
- ✅ **Multiple interfaces** - CLI, API endpoints, or interactive wizard
- ✅ **Detailed logging** - Complete migration report with statistics

## 📋 What Gets Migrated

### Core Data
- ✓ All database tables
- ✓ All table data (with proper ordering)
- ✓ Column definitions and data types
- ✓ Foreign key relationships
- ✓ All indexes

### Database Objects
- ✓ RLS (Row Level Security) policies
- ✓ Database functions and procedures
- ✓ Triggers
- ✓ Sequences

### Authentication & Access
- ✓ Auth users (via Supabase Auth API)
- ✓ Custom user roles
- ✓ User metadata

### Storage
- ✓ Storage buckets
- ✓ Bucket configurations (public/private)

## 🚀 Quick Start

### Method 1: Interactive Setup Wizard (Easiest)

```bash
npm run migrate:setup
```

This launches an interactive wizard that:
1. Asks for source Supabase credentials
2. Asks for target Supabase credentials
3. Performs the complete migration
4. Shows detailed results

### Method 2: CLI Migration

```bash
SOURCE_API_KEY=your_source_key \
TARGET_API_KEY=your_target_key \
npm run migrate:auto -- --source abc123 --target xyz789
```

**Options:**
- `--source <projectId>` - Source project ID (required)
- `--target <projectId>` - Target project ID (required)
- `--no-users` - Skip user migration
- `--no-storage` - Skip storage bucket migration
- `--no-functions` - Skip function migration

### Method 3: API Endpoints

Start the dev server:
```bash
npm run dev:api
```

Then use the migration endpoints:

#### Start Migration
```bash
curl -X POST http://localhost:3001/api/migration/auto-migrate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProjectId": "abc123",
    "sourceApiKey": "your_source_key",
    "targetProjectId": "xyz789",
    "targetApiKey": "your_target_key"
  }'
```

Response:
```json
{
  "success": true,
  "message": "Migration started",
  "migrationId": 1712234567890,
  "estimatedDuration": "5-15 minutes depending on data size"
}
```

#### Check Status
```bash
curl http://localhost:3001/api/migration/status/1712234567890
```

## 🔐 Getting API Keys

### Option 1: Service Role Key (Recommended)
Better for migrations as it has full database access.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Settings > API
4. Find "Service Role Key" in the first section
5. Copy the key (starts with `eyJhbGc...`)

### Option 2: Anon Key
Works but with any RLS restrictions.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Settings > API
4. Find "Anon public" key
5. Copy the key

### Option 3: Custom API Token
Generate a custom token for specific permissions.

1. Go to your Supabase project
2. Create a database role with specific permissions
3. Generate JWT token with that role

## 📝 Usage Examples

### Basic Migration (Everything)
```bash
SOURCE_API_KEY=sbp_source123... \
TARGET_API_KEY=sbp_target456... \
npm run migrate:auto -- --source old-project --target new-project
```

### Skip Users and Storage
```bash
SOURCE_API_KEY=... \
TARGET_API_KEY=... \
npm run migrate:auto -- --source old --target new --no-users --no-storage
```

### From Environment File
Create `.env.migration`:
```
SOURCE_API_KEY=sbp_abc123...
TARGET_API_KEY=sbp_xyz789...
SOURCE_PROJECT_ID=old-project
TARGET_PROJECT_ID=new-project
```

Then run:
```bash
export $(cat .env.migration | xargs)
npm run migrate:auto -- --source $SOURCE_PROJECT_ID --target $TARGET_PROJECT_ID
```

## 🔍 How It Works

```
┌──────────────────────────────────────────────────────────┐
│  User initiates migration (CLI, API, or Wizard)          │
└─────────────────────┬──────────────────────────────────┘
                      │
          ┌───────────────────────┐
          │  Verify Connections   │
          └───────────┬───────────┘
                      │
     ┌────────────────┼─────────────────┐
     │ Export Source  │  Create Target   │
     │ ├─ Schema     │  ├─ Schema       │
     │ ├─ Data       │  ├─ Tables       │
     │ ├─ Policies   │  ├─ Indexes      │
     │ ├─ Users      │  └─ Sequences    │
     │ ├─ Functions  │
     │ ├─ Triggers   │
     │ └─ Storage    │
     └────────────────┼──────────────────┘
                      │
          ┌───────────────────────┐
          │  Import Data to Target │
          └───────────┬───────────┘
                      │
          ┌───────────────────────┐
          │  Migrate Policies      │
          └───────────┬───────────┘
                      │
          ┌───────────────────────┐
          │  Migrate Users & Roles │
          └───────────┬───────────┘
                      │
          ┌───────────────────────┐
          │  Verify Migration      │
          └───────────┬───────────┘
                      │
          ┌───────────────────────┐
          │  Report Results        │
          └───────────────────────┘
```

## 📊 Migration Report

After migration completes, you'll see:

```
✨ Migration Summary:
Status: COMPLETED
Completed: 4/7/2026, 10:30:00 AM

Steps completed: 12
  ✅ verify-connections: Both connections verified
  ✅ schema-export: Exported 15 tables
  ✅ schema-create: Schema created
  ✅ data-export: Exported data from 15 tables
  ✅ data-import: Data imported
  ✅ rls-policies: Migrated 8 RLS policies
  ✅ users: Migrated 3 users
  ✅ user-roles: Migrated 5 user roles
  ✅ storage-buckets: Migrated 2 buckets
  ✅ db-functions: Migrated 1 function
  ✅ triggers: Migrated 2 triggers
  ✅ verification: Verified: Source has 15 tables with 250 rows, Target has 15 tables with 250 rows

🎉 Migration completed successfully!
```

## ⚠️ Important Notes

### Security
1. **Never commit API keys** - Use environment variables or `.env` files
2. **Use Service Role Keys** - They have proper database access
3. **Secure transmission** - Always use HTTPS in production
4. **Limit key scope** - Only use required permissions

### Data Integrity
1. **Backup first** - Always backup before migration
2. **Test with subset** - Test with a small project first
3. **Verify after** - Always verify counts match
4. **Check constraints** - Verify foreign keys and unique constraints

### Performance
1. **Large datasets** - May take 5-15 minutes depending on size
2. **API rate limits** - Consider Supabase rate limits for large imports
3. **Off-peak migration** - Migrate during off-peak hours
4. **Connection limits** - Don't run multiple migrations simultaneously

## 🐛 Troubleshooting

### Connection Failed
```
❌ Connection verification failed
```

**Solution:**
- Verify project ID is correct
- Verify API key is valid and not expired
- Check internet connection
- Ensure Supabase project is active

### API Key Missing
```
❌ Error: Missing API keys
Set SOURCE_API_KEY and TARGET_API_KEY environment variables
```

**Solution:**
```bash
export SOURCE_API_KEY=your_key
export TARGET_API_KEY=your_key
npm run migrate:auto -- --source proj1 --target proj2
```

### Users Not Migrated
```
⚠️ Could not export users via Admin API
```

**Reason:** Using Anon key instead of Service Role key

**Solution:** Use Service Role Key from Settings > API

### RLS Policies Failed
```
⚠️ Could not create policy: User does not have permission
```

**Reason:** Insufficient permissions

**Solution:** Use Service Role Key with full database access

### Data Not Matching
```
Source: 15 tables with 1,250 rows
Target: 15 tables with 1,240 rows
```

**Investigation steps:**
1. Check REST API response limits (default 500,000)
2. Verify RLS policies don't restrict data
3. Check for trigger side effects
4. Manual check specific tables

## 🔧 Advanced Usage

### Custom Migration Functions

Import and use directly in your code:

```typescript
import { SupabaseAutoMigration } from './api/migration/supabase-auto-migration.js';

const migration = new SupabaseAutoMigration(sourceConfig, targetConfig);
const result = await migration.migrate();

console.log(result.steps);
```

### Export Only Specific Data

```bash
curl -X POST http://localhost:3001/api/migration/export \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "abc123",
    "apiKey": "sbp_...",
    "dataType": "policies"
  }'
```

Supported `dataType` values:
- `schema` - Table structures
- `data` - All rows from all tables
- `policies` - RLS policies
- `users` - Auth users
- `storage` - Storage buckets
- `functions` - Database functions
- `triggers` - Database triggers
- `all` or omit - Everything (default)

### Import Exported Data

```bash
curl -X POST http://localhost:3001/api/migration/import \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "xyz789",
    "apiKey": "sbp_...",
    "dataType": "policies",
    "data": [/* policy data */]
  }'
```

## 📚 File Structure

```
api/migration/
├── supabase-auto-migration.ts    # Main migration orchestrator
├── migration-client.ts            # API client for all operations
├── migration-types.ts             # TypeScript types
├── cli.ts                         # Command-line interface
├── setup-wizard.ts                # Interactive setup wizard
└── README.md                      # This file
```

## 🤝 Support

For issues or questions:

1. Check troubleshooting section above
2. Review migration logs for detailed errors
3. Verify API credentials and permissions
4. Test with smaller dataset first
5. Check Supabase documentation for API details

## 📝 License

This migration system is part of the Spartan project.

---

**Last Updated:** April 7, 2026
**Version:** 1.0
**Status:** Production Ready
