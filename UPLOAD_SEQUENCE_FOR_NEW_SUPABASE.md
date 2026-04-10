# 📋 Upload Sequence for New Supabase - Correct Order

## ⚡ Quick Overview
To set up a new Supabase database with all your data, tables, and user accounts, upload these files in **THIS EXACT SERIAL ORDER**:

---

## 📊 Upload Sequence (1st → 2nd → 3rd → 4th)

### **1️⃣ FIRST - Schema & Policies** (MUST BE FIRST)
**File:** `export_schema_policies.sql`  
**Location:** `database-backup/` folder  
**What it does:**
- Creates all database tables
- Creates all columns and data types
- Creates Row Level Security (RLS) policies
- Creates indexes and constraints
- Creates functions and triggers

**Why first:** Without tables, other imports will fail.

**Command (in Supabase SQL Editor):**
```sql
-- Open NEW Supabase → SQL Editor
-- Copy & paste entire export_schema_policies.sql file
-- Click "Run"
```

---

### **2️⃣ SECOND - Users & Authentication** (MUST BE SECOND)
**File:** `export_users_auth.sql`  
**Location:** `database-backup/` folder  
**What it does:**
- Creates all user accounts
- Creates user roles (admin, dealer, manager, etc.)
- Sets up user permissions
- Restores user email and authentication data

**Why second:** Users must exist before assigning data ownership and RLS policies can work.

**Command:**
```sql
-- Open NEW Supabase → SQL Editor
-- Copy & paste entire export_users_auth.sql file
-- Click "Run"
```

---

### **3️⃣ THIRD - Application Data** (MUST BE THIRD)
**File:** `export_application_data.sql`  
**Location:** `database-backup/` folder  
**What it does:**
- Imports all products
- Imports all dealers
- Imports all orders and order details
- Imports all other business data

**Why third:** Tables and users must exist first for foreign keys to work.

**Command:**
```sql
-- Open NEW Supabase → SQL Editor
-- Copy & paste entire export_application_data.sql file
-- Click "Run"
-- ⏱️ This may take a few minutes - be patient!
```

---

### **4️⃣ FOURTH - Post-Migration Fixes** (MUST BE FOURTH)
**File:** `post_migration_fixes.sql`  
**Location:** `database-backup/` folder  
**What it does:**
- Validates all data was imported correctly
- Fixes any migration issues
- Checks foreign key constraints
- Creates validation table showing row counts
- Ensures data integrity

**Why fourth:** Fixes any issues from previous imports and validates everything is correct.

**Command:**
```sql
-- Open NEW Supabase → SQL Editor
-- Copy & paste entire post_migration_fixes.sql file
-- Click "Run"
```

---

## 🎯 Summary of Upload Order

```
1️⃣ export_schema_policies.sql        → Creates empty tables
        ↓
2️⃣ export_users_auth.sql              → Creates user accounts
        ↓
3️⃣ export_application_data.sql        → Fills tables with data
        ↓
4️⃣ post_migration_fixes.sql           → Validates & fixes
        ↓
✅ New Supabase is Ready!
```

---

## ✅ After Upload: Update Your App

Once all 4 files are uploaded successfully:

1. **Get new credentials from Supabase Dashboard**
   - Go to: Settings → API
   - Copy the new Project ID
   - Copy the new Anon Key

2. **Update `.env.local`**
   ```env
   VITE_SUPABASE_URL=https://[NEW-PROJECT-ID].supabase.co
   VITE_SUPABASE_ANON_KEY=[new-anon-key]
   ```

3. **Test the new connection**
   - Login with existing user account
   - Check if dealers/products show up
   - Try creating a new order

4. **Verify everything works**
   - Users can login ✓
   - Data is visible ✓
   - Can create/edit/delete records ✓

---

## ⚠️ Important Notes

- **ALL 4 FILES MUST BE RUN IN THIS ORDER** - Don't skip any step!
- Errors in Step 1 will prevent Steps 2, 3, 4 from working
- If Step 3 fails, data won't be in the database
- Always run Step 4 to validate everything worked

---

## 🐛 If Something Goes Wrong

**Error in Step 1?** → Schema tables didn't create. Fix errors and re-run.  
**Error in Step 2?** → Users not created. Steps 3 will fail. Fix and re-run.  
**Error in Step 3?** → Data didn't import. Check foreign key constraints.  
**Error in Step 4?** → Validation found issues. Review validation table.

---

**🎉 Once all 4 steps complete successfully, your new Supabase is ready to use!**
