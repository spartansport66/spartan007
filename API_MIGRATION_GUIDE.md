# 🎯 API-Based Migration Complete Guide

## What's New?

### Old Way (Password-Based) ❌
```
❌ Requires database passwords in plain text
❌ Uses psql command line directly
❌ Manual PowerShell script prompts
❌ Only migrates tables and basic schema
❌ No built-in RLS policy migration
❌ Separate manual steps for users
❌ Difficult to automate
```

### New Way (API-Based) ✅
```
✅ Uses secure API keys (no passwords)
✅ Automatic end-to-end migration
✅ Interactive wizard for easy setup
✅ Migrates EVERYTHING (tables, schema, policies, users, storage)
✅ Includes RLS policies automatically
✅ Handles users and roles
✅ CLI, API endpoints, and wizard interfaces
✅ Easy to automate and CI/CD integration
```

## Getting Started in 3 Steps

### Step 1: Get Your API Keys

#### For Source Supabase (Where your data is)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the project with your data
3. Go to **Settings** → **API**
4. Copy the **Service Role Key** (also called "Service role secret")
5. Save it (you'll need it in Step 3)

#### For Target Supabase (Where you want data to go)
1. Create a new Supabase project (or use existing)
2. Repeat steps 1-4 above for this project
3. Save this key too

### Step 2: Choose Your Migration Method

#### Option A: Interactive Wizard (Easiest)
```bash
npm run migrate:setup
```
- Just run the command
- Follow the prompts
- Paste your API keys when asked
- Watch the progress

#### Option B: PowerShell Script (Windows)
```powershell
.\migrate-api.ps1
```
- Double-click the file or run in PowerShell
- Interactive prompts guide you through
- Automatically handles everything

#### Option C: Bash Script (macOS/Linux)
```bash
bash migrate-api.sh
```
- Run in terminal
- Follow the prompts
- Done!

#### Option D: Command Line (Advanced)
```bash
SOURCE_API_KEY=your_source_key TARGET_API_KEY=your_target_key \
npm run migrate:auto -- --source old-project-id --target new-project-id
```

#### Option E: API Endpoints (Programmatic)
```bash
curl -X POST http://localhost:3001/api/migration/auto-migrate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProjectId": "old-project",
    "sourceApiKey": "your_source_key",
    "targetProjectId": "new-project",
    "targetApiKey": "your_target_key"
  }'
```

### Step 3: Monitor Migration

The system will automatically:
1. Verify both projects are accessible
2. Export your complete schema and data
3. Create tables in the target project
4. Import all your data
5. Migrate RLS policies
6. Migrate users and roles
7. Set up storage buckets
8. Recreate database functions
9. Recreate triggers
10. Verify everything matches

You'll see progress output like:
```
🔍 Step 1: Verifying connections...
📤 Step 2: Exporting schema...
📥 Step 3: Creating schema in target...
📤 Step 4: Exporting data...
📥 Step 5: Importing data...
🔐 Step 6: Migrating RLS policies...
👥 Step 7: Migrating users...
👤 Step 8: Migrating user roles...
💾 Step 9: Migrating storage buckets...
⚙️ Step 10: Migrating database functions...
⚡ Step 11: Migrating triggers...
✅ Step 12: Verifying migration...
```

## Complete Checklist

Before migration:
- [ ] I have the Service Role Key for my source project
- [ ] I have the Service Role Key for my target project
- [ ] I've backed up my current database
- [ ] I understand what will be migrated
- [ ] The target project is empty or I'm okay with overwriting data

During migration:
- [ ] I'm running the migration from the Spartan project directory
- [ ] I've picked one of the 5 methods above
- [ ] My API keys are correct and not expired
- [ ] I have internet connection
- [ ] I'm not running multiple migrations simultaneously

After migration:
- [ ] I've checked the migration report
- [ ] I've verified data in the Supabase dashboard
- [ ] Row counts match between source and target
- [ ] I've tested key functionality
- [ ] I've updated my environment variables if needed

## Common Tasks

### Task: Migrate Only Tables and Data (Skip Users/Storage)
```bash
SOURCE_API_KEY=... TARGET_API_KEY=... \
npm run migrate:auto -- --source old --target new --no-users --no-storage
```

### Task: Skip Database Functions
```bash
SOURCE_API_KEY=... TARGET_API_KEY=... \
npm run migrate:auto -- --source old --target new --no-functions
```

### Task: Migrate Just Policies (After Manual Data Copy)
```bash
curl -X POST http://localhost:3001/api/migration/export \
  -d '{"projectId":"old-proj","apiKey":"...","dataType":"policies"}'
```

### Task: Check If Migration is Still Running
```bash
curl http://localhost:3001/api/migration/status
```

### Task: Export All Data for Backup
```bash
curl -X POST http://localhost:3001/api/migration/export \
  -H "Content-Type: application/json" \
  -d '{"projectId":"your-proj","apiKey":"...","dataType":"all"}'
```

## Security Best Practices

1. **Never commit API keys**
   ```
   # Good ✅
   export SOURCE_API_KEY=your_key
   npm run migrate:auto
   
   # Bad ❌
   npm run migrate:auto --api-key sbp_abc123... (visible in history)
   ```

2. **Use Environment Variables**
   ```bash
   # Create .env.migration file (add to .gitignore)
   SOURCE_API_KEY=sbp_...
   TARGET_API_KEY=sbp_...
   
   # Load it before running
   export $(cat .env.migration | xargs)
   npm run migrate:auto
   ```

3. **Rotate Keys After Migration**
   - After successful migration, rotate your API keys
   - Go to Supabase Settings > API
   - Regenerate Service Role Key

4. **Use Service Role Keys Only**
   - Anon keys have RLS restrictions
   - Service Role keys bypass RLS for migrations
   - Service Role keys are for trusted operations

## Troubleshooting

### Problem: "Connection Failed"
```
❌ Connection verification failed
```

**Fix:** Check that:
- Project ID is correct (no spaces, exact match)
- API key is correct and not expired
- You have internet connection
- Supabase project is active

### Problem: "Users Not Migrated"
```
⚠️ Could not export users via Admin API
```

**Fix:** Make sure you're using Service Role Key, not Anon key

### Problem: "Permission Denied on RLS Policies"
```
❌ User does not have permission to create policy
```

**Fix:** Use Service Role Key with full database access

### Problem: "Row Count Mismatch"
```
Source: 1000 rows
Target: 950 rows
```

**Fix:**
- Check RLS policies aren't restricting visibility
- Check if triggers are preventing inserts
- Try running specific table exports

### Problem: "Migration is Taking Too Long"
- Large datasets may take up to 15 minutes
- Monitor API rate limits
- Make sure you have good internet
- Don't interrupt the process

## Next Steps After Migration

1. **Update Your App Configuration**
   ```
   Old project ID: abc123
   New project ID: xyz789
   
   Update in your app:
   - .env files
   - Vercel environment variables
   - Docker configuration
   - Any hardcoded URLs
   ```

2. **Test Your Application**
   - Update connection strings
   - Run full test suite
   - Test critical workflows
   - Check API endpoints

3. **Point Your Domain**
   - Update database URLs in production
   - Update Vercel environment variables
   - Update any DNS records
   - Update SSL certificates if needed

4. **Decommission Old Project**
   - Wait 24-48 hours to ensure all works
   - Archive old project data
   - Delete old project (if not needed)
   - Update documentation

5. **Notify Your Team**
   - Update internal documentation
   - Tell team about new project URL
   - Update Slack/Teams bookmarks
   - Update wiki/runbooks

## Performance Notes

- **Small projects** (< 100MB): ~2-5 minutes
- **Medium projects** (100MB-1GB): ~5-10 minutes
- **Large projects** (> 1GB): ~10-30 minutes

Factors affecting speed:
- Internet connection speed
- Current server load
- Number of tables and rows
- Complexity of RLS policies
- Number of functions and triggers

## Support & Help

1. Check the troubleshooting section above
2. Review detailed migration logs (shown on screen)
3. Check Supabase dashboard for errors
4. Verify API credentials
5. Test with smaller subset first

## File Structure

All migration files are in `/api/migration/`:
- `supabase-auto-migration.ts` - Main orchestrator
- `migration-client.ts` - API communication
- `migration-types.ts` - TypeScript definitions
- `cli.ts` - Command-line interface
- `setup-wizard.ts` - Interactive wizard
- `README.md` - Detailed documentation

## Scripts Available

```bash
npm run migrate:setup       # Interactive setup wizard
npm run migrate:auto        # CLI migration
npm run migrate:wizard      # Alias for setup wizard
npm run dev:api            # Start API server (for endpoints)
```

---

**Ready to migrate?** Pick one of the 5 methods and get started! 🚀

For detailed documentation, see `/api/migration/README.md`
