# ✅ Complete Setup Guide - New Supabase Migration

## 🎯 Three-File Process (UPDATED)

You now have **ONE working file** ready. Here's what to do next:

---

## ✅ FILE 1: `export_schema_policies.sql` - READY TO USE
**Status:** ✅ COMPLETE & EXECUTABLE

This file contains:
- All CREATE TABLE statements
- All database structure (columns, types, constraints)
- All RLS policies
- All indexes

### Use It:
1. Go to NEW Supabase → SQL Editor
2. Paste entire `export_schema_policies.sql`
3. Click "Run"
4. ✅ All tables will be created

---

## 📝 FILES 2 & 3: User Data & Application Data

These files MUST be generated from your CURRENT Supabase database because they contain real data.

### Method 1: Use Supabase Dashboard Backup (RECOMMENDED)
1. Go to Current Supabase → Settings → Backups
2. Click "Create Backup"
3. Download the backup file
4. This backup has everything (users + data)

### Method 2: Use the App's Migration Tool
1. Go to `/admin` page
2. Click "Database Backup & Migration"
3. Download backup files from there
4. Then use `/upload-to-new-supabase` page

### Method 3: Manual Export (Advanced)
If you need SQL files specifically:
1. Current Supabase → SQL Editor
2. Run this to export users:
```sql
SELECT 'INSERT INTO public.profiles (id, first_name, last_name, is_admin, user_type, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(first_name) || ', ' ||
  quote_literal(last_name) || ', ' ||
  is_admin || ', ' ||
  quote_literal(user_type) || ', ' ||
  quote_literal(created_at) || ', ' ||
  quote_literal(updated_at) || ');'
FROM public.profiles;
```
3. Copy output → Save as `export_users_auth.sql`

---

## 🚀 COMPLETE SETUP STEPS

### Step 1: Create Empty Database Structure ✅ (READY)
```
1. NEW Supabase → SQL Editor
2. Paste export_schema_policies.sql
3. Click "Run"
4. Wait for completion
```

### Step 2: Add Users (Choose ONE method)

**OPTION A: Using Backup File**
```
1. Go to Current Supabase → Settings → Backups
2. Create and download backup
3. New Supabase → Import backup
```

**OPTION B: Using App Migration Tools**
```
1. Go to /admin dashboard
2. Use "Database Backup & Migration" page
3. Download backup files
4. Use "Upload to New Supabase" page
5. Select downloaded files + New credentials
6. Click "Upload"
```

**OPTION C: Manual SQL Export (Advanced)**
```
1. Run queries on Current Supabase to export data
2. Create SQL files from results
3. Run on New Supabase
```

### Step 3: Verify Everything Works
```
1. Test login with existing user
2. Check if dealers show up
3. Create new order - should work
4. Check RLS policies working
```

---

## 📊 Status Summary

| File | Status | Action |
|------|--------|--------|
| `export_schema_policies.sql` | ✅ Ready | Use in NEW Supabase SQL Editor |
| `export_users_auth.sql` | ⏳ Manual | Generate from current DB or use backup |
| `export_application_data.sql` | ⏳ Manual | Generate from current DB or use backup |
| `post_migration_fixes.sql` | ⏳ Manual | Generate or use automated tools |

---

## ⚡ RECOMMENDED: Use the App's Built-In Tools

**Don't manually create SQL files!** Your app already has tools for this:

### Dashboard Routes:
1. `/database-backup-migration` → Download backup files
2. `/upload-to-new-supabase` → Upload to new database

These tools automatically handle:
- User export/import
- Data export/import
- Validation
- Error reporting

---

## ✅ What's Next?

**Today:**
1. ✅ Run `export_schema_policies.sql` on NEW Supabase
2. ⏳ Export users + data (use app tools or backup)
3. ⏳ Upload to new database

**Result:** Fully functional new Supabase ready to use!

---

## 📞 Need Help?

- File 1 works? → Next step is user/data import
- Using backup? → Supabase will handle everything
- Using app tools? → Go to `/admin` → "Database Backup & Migration"

**The schema file is ready to go! 🎉**
