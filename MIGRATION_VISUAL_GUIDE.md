# 🎨 Visual Step-by-Step Migration Guide

## Step 1: Get Your API Keys 🔑

### Getting Source API Key (Your Current Data)

1. **Open Supabase Dashboard**
   ```
   Go to: https://supabase.com/dashboard
   ```

2. **Select Your Project**
   ```
   Click on the project that has your data
   ```

3. **Navigate to Settings > API**
   ```
   Left sidebar: Settings → API
   ```

4. **Find Service Role Key**
   ```
   Look for "Service Role" section at the top
   You'll see a key that starts with: sbp_...
   ```

5. **Copy the Key**
   ```
   Click the copy icon next to the Service Role Key
   ```

6. **Save It Somewhere Safe**
   ```
   Keep this key handy for the next step
   ⚠️ Never share this key or commit it to git
   ```

### GetTargetAPI Key (Your New Project)

Repeat steps 1-6 for your target Supabase project

---

## Step 2: Choose Your Migration Method 🚀

### Method 1: Interactive Setup (Easiest) ⭐

```bash
# Navigate to your project
cd path/to/spartan

# Run the setup wizard
npm run migrate:setup
```

**What happens:**
```
? Enter your source Supabase project ID: 
  ↳ Type: old-project-abc123

? Enter your source API key:
  ↳ Paste: sbp_source123456789...

? Enter your target Supabase project ID:
  ↳ Type: new-project-xyz789

? Enter your target API key:
  ↳ Paste: sbp_target987654321...

🚀 Starting migration...
[Progress shown here]

✨ Migration completed successfully!
```

### Method 2: Windows PowerShell Script

```powershell
# Navigate to project
cd C:\Users\Admin\dyad-apps\spartan

# Run the script
.\migrate-api.ps1
```

**Follow the prompts:**
```
👉 Source Supabase Configuration
Enter source project ID: old-project-abc123
Enter source API key: [paste your key]

👉 Target Supabase Configuration
Enter target project ID: new-project-xyz789
Enter target API key: [paste your key]

📋 Migration Configuration
  Source Project:   old-project-abc123
  Target Project:   new-project-xyz789
  Include Users:    Yes
  Include Storage:  Yes
  Include Functions: Yes

Proceed with migration? (yes/no): yes

[Migration runs...]

✨ MIGRATION COMPLETED SUCCESSFULLY
```

### Method 3: macOS/Linux Bash Script

```bash
# Navigate to project
cd /path/to/spartan

# Run the script
bash migrate-api.sh
```

**Same prompts as PowerShell version above**

### Method 4: Command Line (Advanced)

```bash
# Windows
set SOURCE_API_KEY=sbp_your_source_key
set TARGET_API_KEY=sbp_your_target_key
npm run migrate:auto -- --source old-proj --target new-proj

# macOS/Linux
export SOURCE_API_KEY=sbp_your_source_key
export TARGET_API_KEY=sbp_your_target_key
npm run migrate:auto -- --source old-proj --target new-proj
```

### Method 5: Using API Endpoints

Start the API server:
```bash
npm run dev:api
```

In another terminal:
```bash
curl -X POST http://localhost:3001/api/migration/auto-migrate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceProjectId": "old-project-abc123",
    "sourceApiKey": "sbp_source_key_here",
    "targetProjectId": "new-project-xyz789",
    "targetApiKey": "sbp_target_key_here"
  }'
```

---

## Step 3: Watch the Migration 👀

As migration runs, you'll see progress like this:

```
🔍 Step 1: Verifying connections...
✅ Both connections verified

📤 Step 2: Exporting schema...
✅ Exported 15 tables

📥 Step 3: Creating schema in target...
✅ Schema created

📤 Step 4: Exporting data...
✅ Exported data from 15 tables

📥 Step 5: Importing data...
✅ Data imported

🔐 Step 6: Migrating RLS policies...
✅ Migrated 8 RLS policies

👥 Step 7: Migrating users...
✅ Migrated 3 users

👤 Step 8: Migrating user roles...
✅ Migrated 5 user roles

💾 Step 9: Migrating storage buckets...
✅ Migrated 2 buckets

⚙️ Step 10: Migrating database functions...
✅ Migrated 1 function

⚡ Step 11: Migrating triggers...
✅ Migrated 2 triggers

✅ Step 12: Verifying migration...
✅ Verified: Source has 15 tables with 1,250 rows
✅ Target has 15 tables with 1,250 rows

🎉 Migration completed successfully!
```

---

## Step 4: Verify the Migration ✅

### Check in Supabase Dashboard

1. **Go to your target project**
   ```
   https://supabase.com/dashboard → Select new project
   ```

2. **Check Tables**
   ```
   Left sidebar: Database → Tables
   Should see all your tables with data
   ```

3. **Check Storage**
   ```
   Left sidebar: Storage
   Should see your buckets
   ```

4. **Check RLS Policies**
   ```
   Left sidebar: Database → Tables → Select table → RLS Policies
   Should see your policies
   ```

5. **Check Row Counts**
   ```
   Click each table and verify row count matches source
   ```

---

## Step 5: Update Your Application 🔄

Once verified, update your app:

### Update Environment Variables

**If using .env file:**
```env
# OLD (don't use anymore)
# VITE_SUPABASE_URL=https://old-project-abc123.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJhbGc...old_key

# NEW (update to)
VITE_SUPABASE_URL=https://new-project-xyz789.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...new_key
```

**If using Vercel:**
```
1. Go to Vercel Dashboard
2. Select your project
3. Settings → Environment Variables
4. Update VITE_SUPABASE_URL
5. Update VITE_SUPABASE_ANON_KEY
6. Redeploy
```

### Test Your Application

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Test key features:
# ✅ Login works
# ✅ Can view data
# ✅ Can create/edit/delete
# ✅ Storage buckets work
# ✅ API calls return correct data
```

---

## Step 6: Go Live 🎯

### Pre-Launch Checklist

- [ ] Migration completed successfully
- [ ] Data verified in dashboard
- [ ] Row counts match
- [ ] Application tested locally
- [ ] Environment variables updated
- [ ] No console errors
- [ ] All features working

### Launch

```bash
# Deploy to production
npm run build
vercel deploy --prod
```

### Post-Launch

1. **Monitor for errors**
   - Check browser console
   - Check Vercel logs
   - Check Supabase logs

2. **Notify team**
   - Update documentation
   - Tell team members
   - Update bookmarks

3. **Keep cool backups**
   - Keep old project as backup for 48 hours
   - Then archive/delete

---

## 🐛 Troubleshooting Guide

### Issue: "Connection Failed"

**Error Message:**
```
❌ Connection verification failed
```

**Causes & Solutions:**
```
1. Wrong project ID?
   ✓ Check project ID from Supabase dashboard
   ✓ Make sure no extra spaces

2. API key expired?
   ✓ Go to Settings > API
   ✓ Make sure key matches exactly
   ✓ Try regenerating the key

3. Internet connection?
   ✓ Check your connection
   ✓ Try pinging Supabase
   ✓ Restart router if needed
```

### Issue: "Users Not Migrated"

**Error Message:**
```
⚠️ Could not export users via Admin API
```

**Solution:**
```
This happens when using Anon key instead of Service Role key
✓ Go back to Supabase Settings > API
✓ Use "Service Role" key (not "Anon public")
✓ Try migration again
```

### Issue: "Row Count Mismatch"

**Error Message:**
```
Source: 1000 rows
Target: 950 rows
```

**Investigation:**
```
1. Check specific tables:
   ✓ Click each table in dashboard
   ✓ Compare row counts

2. Check for RLS issues:
   ✓ Make sure RLS policies allow viewing
   ✓ Test with user role

3. Manual verification:
   ✓ Count rows manually in SQL
   ✓ Check for missing data

4. Re-run migration:
   ✓ Clear target table if needed
   ✓ Run migration again
```

### Issue: "Migration Taking Too Long"

```
Normal timeframes:
- Small project (< 100MB): 2-5 minutes
- Medium project (100MB-1GB): 5-15 minutes
- Large project (> 1GB): 15-30 minutes

If exceeding these:
✓ Check internet speed
✓ Don't close terminal/browser
✓ Check Supabase dashboard for errors
✓ Try again from beginning
```

---

## 📊 Example Migration Flow

```
START
  │
  ├─ Collect credentials
  │   ├─ Source project ID
  │   ├─ Source API key
  │   ├─ Target project ID
  │   └─ Target API key
  │
  ├─ Verify connections
  │   └─ Both projects accessible? ✅
  │
  ├─ Export from source
  │   ├─ Tables: 15 found
  │   ├─ Data: 1,250 rows exported
  │   ├─ RLS Policies: 8 exported
  │   └─ Users: 3 exported
  │
  ├─ Create in target
  │   ├─ Tables created: 15
  │   ├─ Indexes created: 20
  │   └─ Sequences created: 5
  │
  ├─ Import data
  │   ├─ Data inserted: 1,250 rows
  │   ├─ RLS policies created: 8
  │   └─ Users created: 3
  │
  └─ Verify
      ├─ Row count: 1,250 = 1,250 ✅
      ├─ Table count: 15 = 15 ✅
      └─ SUCCESS!
         │
         └─ Next: Update app & go live
```

---

## 🎓 Learning Resources

- **Full Documentation:** `/api/migration/README.md`
- **Quick Reference:** `/MIGRATION_QUICK_REFERENCE.md`
- **Complete Guide:** `/API_MIGRATION_GUIDE.md`
- **This File:** `/MIGRATION_VISUAL_GUIDE.md`

---

## ✨ You're All Set!

Follow the steps above and your migration will complete successfully!

**Still have questions?** Check the troubleshooting section or review the full documentation.

**Ready to go?** Run: `npm run migrate:setup` 🚀
