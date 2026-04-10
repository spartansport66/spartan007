# 📚 Supabase API Migration Documentation Index

Complete documentation for the new API-based Supabase migration system. Start here!

## 🚀 Quick Start (Pick One)

### I Want to Migrate NOW (Fastest)
**→ Start here:** `npm run migrate:setup`

This runs the interactive setup wizard that walks you through everything step-by-step.

### I Want Detailed Instructions
**→ Read:** [`MIGRATION_VISUAL_GUIDE.md`](./MIGRATION_VISUAL_GUIDE.md)
Visual step-by-step with screenshots and examples

### I Want a Quick Reference
**→ Read:** [`MIGRATION_QUICK_REFERENCE.md`](./MIGRATION_QUICK_REFERENCE.md)
Cheat sheet with all commands and options

### I Want Complete Documentation
**→ Read:** [`API_MIGRATION_GUIDE.md`](./API_MIGRATION_GUIDE.md)
Comprehensive guide with all details

### I Want Developer Docs
**→ Read:** [`api/migration/README.md`](./api/migration/README.md)
Technical documentation for developers

---

## 📖 Documentation Files

| File | Best For | Read Time |
|------|----------|-----------|
| **MIGRATION_VISUAL_GUIDE.md** | Step-by-step with examples | 10 min |
| **API_MIGRATION_GUIDE.md** | Understanding everything | 15 min |
| **MIGRATION_QUICK_REFERENCE.md** | Quick lookup | 5 min |
| **api/migration/README.md** | Technical deep-dive | 20 min |

---

## 🎯 Choosing the Right Migration Method

### 1️⃣ Interactive Setup Wizard (Easiest)
```bash
npm run migrate:setup
```
- **Best for:** First-time users
- **Difficulty:** ⭐ Very Easy
- **Setup time:** 30 seconds
- **Pros:** Guided, foolproof, interactive
- **Cons:** None really

### 2️⃣ PowerShell Script (Windows)
```powershell
.\migrate-api.ps1
```
- **Best for:** Windows users
- **Difficulty:** ⭐ Very Easy
- **Setup time:** 1 minute
- **Pros:** Visual, prompts, easy
- **Cons:** Windows only

### 3️⃣ Bash Script (macOS/Linux)
```bash
bash migrate-api.sh
```
- **Best for:** macOS/Linux users
- **Difficulty:** ⭐ Very Easy
- **Setup time:** 1 minute
- **Pros:** Visual, prompts, easy
- **Cons:** Unix only

### 4️⃣ CLI Command
```bash
SOURCE_API_KEY=... TARGET_API_KEY=... \
npm run migrate:auto -- --source old --target new
```
- **Best for:** Advanced users, automation
- **Difficulty:** ⭐⭐ Intermediate
- **Setup time:** 2 minutes
- **Pros:** Fast, scriptable, full control
- **Cons:** Need to set env vars

### 5️⃣ API Endpoints
```bash
curl -X POST http://localhost:3001/api/migration/auto-migrate \
  -d '{"sourceProjectId":"...","sourceApiKey":"...","targetProjectId":"...","targetApiKey":"..."}'
```
- **Best for:** Programmatic use, CI/CD
- **Difficulty:** ⭐⭐⭐ Advanced
- **Setup time:** 5 minutes
- **Pros:** Fully automated, integrable
- **Cons:** Need to run API server

---

## ⚡ One-Minute Setup

1. **Get API Keys** (1 minute)
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Settings → API
   - Copy "Service Role Key" for both projects

2. **Run Migration** (30 seconds)
   ```bash
   npm run migrate:setup
   ```
   Follow the prompts, paste your keys

3. **Wait** (2-30 minutes depending on size)
   - Watch the progress on screen
   - Don't close the terminal

4. **Done!** ✨
   - Check the dashboard
   - Update your app
   - Go live

---

## 🎓 Common Scenarios

### Scenario 1: "I'm New to Supabase Migrations"
1. Read: [`MIGRATION_VISUAL_GUIDE.md`](./MIGRATION_VISUAL_GUIDE.md)
2. Run: `npm run migrate:setup`
3. Follow: On-screen prompts

### Scenario 2: "I'm Technical and Want All Details"
1. Read: [`API_MIGRATION_GUIDE.md`](./API_MIGRATION_GUIDE.md)
2. Read: [`api/migration/README.md`](./api/migration/README.md)
3. Run: `npm run migrate:auto` or use API endpoints

### Scenario 3: "I Just Want to Get It Done"
1. Run: `npm run migrate:setup`
2. That's it - everything else is automatic!

### Scenario 4: "I Need to Automate This"
1. Read: [`api/migration/README.md`](./api/migration/README.md)
2. Use: API endpoints or CLI with environment variables
3. Integrate: Into your CI/CD pipeline

### Scenario 5: "I'm Stuck"
1. Check: [`MIGRATION_QUICK_REFERENCE.md`](./MIGRATION_QUICK_REFERENCE.md) troubleshooting
2. Review: [`API_MIGRATION_GUIDE.md`](./API_MIGRATION_GUIDE.md) troubleshooting
3. Check: [`api/migration/README.md`](./api/migration/README.md) for technical details

---

## ✨ What Gets Migrated

Everything! Including:
- ✅ All database tables
- ✅ All your data (rows)
- ✅ Primary & foreign keys
- ✅ Indexes
- ✅ RLS (Row Level Security) policies
- ✅ Auth users and roles
- ✅ Storage buckets
- ✅ Database functions
- ✅ Triggers

---

## 🔐 Security Overview

### Old Way (Password-Based) ❌
```
❌ Database passwords in plain text
❌ Visible in command history
❌ Hard to automate safely
❌ Difficult to audit
```

### New Way (API-Based) ✅
```
✅ Uses secure API keys
✅ No passwords exposed
✅ Easy to store in env vars
✅ Trackable and auditable
✅ Works with CI/CD pipelines
✅ Rotatable key management
```

### Best Practices
1. Never commit API keys to git
2. Use `.env` files (add to `.gitignore`)
3. Use service role keys (for migrations)
4. Rotate keys after migration
5. Use environment variables

---

## 📊 Expected Duration

| Project Size | Time | Notes |
|--------------|------|-------|
| Small | 2-5 min | < 100MB, < 100K rows |
| Medium | 5-15 min | 100MB-1GB, 100K-1M rows |
| Large | 15-30 min | > 1GB, > 1M rows |

---

## 🚀 NPM Scripts Available

```bash
# Interactive setup wizard (recommended)
npm run migrate:setup

# CLI migration with flags
npm run migrate:auto -- [options]

# Alias for setup wizard
npm run migrate:wizard

# Start API server for endpoints
npm run dev:api
```

---

## 📁 File Locations

```
spartan/
├── api/migration/               # Migration system
│   ├── README.md               # Technical documentation
│   ├── supabase-auto-migration.ts
│   ├── migration-client.ts
│   ├── migration-types.ts
│   ├── cli.ts
│   └── setup-wizard.ts
├── MIGRATION_VISUAL_GUIDE.md    # Step-by-step guide
├── API_MIGRATION_GUIDE.md       # Complete guide
├── MIGRATION_QUICK_REFERENCE.md # Cheat sheet
├── MIGRATION_INDEX.md           # This file
├── migrate-api.ps1              # Windows script
├── migrate-api.sh               # macOS/Linux script
└── package.json                 # npm scripts
```

---

## 🎯 Your Next Steps

### For First-Time Users
1. **Read:** [`MIGRATION_VISUAL_GUIDE.md`](./MIGRATION_VISUAL_GUIDE.md)
2. **Run:** `npm run migrate:setup`
3. **Verify:** Check dashboard
4. **Update:** App configuration
5. **Test:** Before going live

### For Developers
1. **Read:** [`api/migration/README.md`](./api/migration/README.md)
2. **Understand:** Architecture and types
3. **Choose:** CLI, API, or custom integration
4. **Implement:** Based on your needs
5. **Test:** Thoroughly before production

### For DevOps/Automation
1. **Read:** [`API_MIGRATION_GUIDE.md`](./API_MIGRATION_GUIDE.md) - Advanced section
2. **Setup:** CI/CD integration with API endpoints
3. **Configure:** Environment variables
4. **Test:** With test projects
5. **Deploy:** To production automation

---

## ❓ FAQ

**Q: Is this safe?**
A: Yes! API-based migration is safer than password-based. No passwords are stored or exposed.

**Q: What if I mess up?**
A: Your source data stays intact. Target project can be recreated. Start over anytime.

**Q: How long does it take?**
A: 2-30 minutes depending on data size. Not overnight jobs.

**Q: Can I migrate to a non-empty project?**
A: Yes, but it will replace/merge data. Backup first.

**Q: Can I automate this?**
A: Yes! Use API endpoints or CLI with environment variables.

**Q: What if migration fails halfway?**
A: Safe to try again. Duplicate data might occur (easy to fix).

**Q: Do I need to shut down my app?**
A: Not for the migration, but update after before going live.

---

## 📞 Support Resources

1. **Quick Lookup:** [`MIGRATION_QUICK_REFERENCE.md`](./MIGRATION_QUICK_REFERENCE.md)
2. **Step-by-Step:** [`MIGRATION_VISUAL_GUIDE.md`](./MIGRATION_VISUAL_GUIDE.md)
3. **Complete Info:** [`API_MIGRATION_GUIDE.md`](./API_MIGRATION_GUIDE.md)
4. **Technical Docs:** [`api/migration/README.md`](./api/migration/README.md)
5. **Troubleshooting:** Check any of above (all have troubleshooting sections)

---

## 🎉 Ready to Start?

### Quickest Path
```bash
npm run migrate:setup
```

### With Details
1. Read [`MIGRATION_VISUAL_GUIDE.md`](./MIGRATION_VISUAL_GUIDE.md)
2. Run `npm run migrate:setup`

### Full Understanding
1. Read [`API_MIGRATION_GUIDE.md`](./API_MIGRATION_GUIDE.md)
2. Read [`api/migration/README.md`](./api/migration/README.md)
3. Choose your method
4. Run migration

---

**Status:** ✅ Production Ready
**Version:** 1.0
**Last Updated:** April 7, 2026

**Questions?** Read the relevant document above or check the troubleshooting sections.

**Let's go!** 🚀
